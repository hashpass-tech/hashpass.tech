import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const EVENT_SLUG = 'bsl-bogota-2026-demo';
const configs = { congestionRate: 40, congestionWait: 8, duplicateWindowMs: 90_000, speakerWindowMinutes: 20, autonomyMode: 'APPROVAL' };

export const state = query({ args: { slug: v.optional(v.string()) }, handler: async (ctx, args) => {
  const event = await ctx.db.query('events').withIndex('by_slug', q => q.eq('slug', args.slug ?? EVENT_SLUG)).unique();
  if (!event) return null;
  const [gates, sessions, incidents, audit] = await Promise.all([
    ctx.db.query('gates').withIndex('by_event', q => q.eq('eventId', event._id)).collect(),
    ctx.db.query('sessions').withIndex('by_event', q => q.eq('eventId', event._id)).collect(),
    ctx.db.query('incidents').withIndex('by_event', q => q.eq('eventId', event._id)).order('desc').collect(),
    ctx.db.query('auditLogs').withIndex('by_event_time', q => q.eq('eventId', event._id)).order('desc').take(30),
  ]);
  const enriched = await Promise.all(incidents.map(async incident => ({ ...incident, recommendation: await ctx.db.query('recommendations').withIndex('by_incident', q => q.eq('incidentId', incident._id)).first() })));
  return { event, gates, sessions, incidents: enriched, audit };
}});

export const resetDemo = mutation({ args: {}, handler: async ctx => {
  for (const table of ['auditLogs','agentRuns','actions','recommendations','incidents','operationalEvents','simulatorRuns','sessions','gates','events'] as const) {
    const rows = await ctx.db.query(table).collect(); for (const row of rows) await ctx.db.delete(row._id);
  }
  const now = Date.now();
  const eventId = await ctx.db.insert('events', { externalEventId: 'bsl-bogota-2026-demo', slug: EVENT_SLUG, name: 'BSL Bogotá 2026 Demo', timezone: 'America/Bogota', status: 'live', configuration: configs });
  for (const gate of [
    { gateId: 'gate-main', name: 'Main Entrance', nominalCapacityPerMinute: 25, currentCheckinRate: 18, estimatedWaitMinutes: 2, status: 'healthy' },
    { gateId: 'gate-vip', name: 'VIP / Speakers', nominalCapacityPerMinute: 15, currentCheckinRate: 4, estimatedWaitMinutes: 1, status: 'healthy' },
    { gateId: 'gate-secondary', name: 'Secondary Entrance', nominalCapacityPerMinute: 30, currentCheckinRate: 7, estimatedWaitMinutes: 1, status: 'healthy' },
  ]) await ctx.db.insert('gates', { eventId, ...gate, lastUpdatedAt: now });
  await ctx.db.insert('sessions', { eventId, sessionId: 'session-main', title: 'Programmable trust in the real world', room: 'Main Stage', startsAt: now + 42*60_000, endsAt: now + 102*60_000, capacity: 600, currentOccupancy: 428, speakerIds: ['speaker-maya'], speakerStatuses: { 'speaker-maya': 'checked_in' }, status: 'scheduled' });
  await ctx.db.insert('auditLogs', { eventId, actor: 'simulator', action: 'DEMO_RESET', entityType: 'event', entityId: String(eventId), timestamp: now, metadata: { seed: 20260906, simulation: true } });
  return eventId;
}});

export const triggerScenario = mutation({ args: { scenario: v.union(v.literal('gate_surge'), v.literal('duplicate_pass'), v.literal('speaker_delay')) }, handler: async (ctx, { scenario }) => {
  const event = await ctx.db.query('events').withIndex('by_slug', q => q.eq('slug', EVENT_SLUG)).unique(); if (!event) throw new Error('Reset the demo first');
  const now = Date.now();
  await ctx.db.insert('simulatorRuns', { eventId: event._id, scenario, seed: 20260906, status: 'completed', startedAt: now, completedAt: now });
  if (scenario === 'gate_surge') {
    const gate = await ctx.db.query('gates').withIndex('by_event_gate', q => q.eq('eventId', event._id)).filter(q => q.eq(q.field('gateId'), 'gate-main')).unique(); if (!gate) throw new Error('Gate missing');
    await ctx.db.patch(gate._id, { currentCheckinRate: 68, estimatedWaitMinutes: 14, status: 'congested', lastUpdatedAt: now });
    for (let i=0;i<12;i++) await ctx.db.insert('operationalEvents', { eventId: event._id, eventType: 'CHECK_IN', source: 'deterministic-simulator', timestamp: now+i, passIdHash: `sha256:synthetic-${i}`, gateId: gate.gateId, payload: { seed: 20260906 }, simulation: true });
    await createIncident(ctx, event._id, 'GATE_CONGESTION', 'high', 'Main Entrance congestion detected', ['68 scans/min vs 25 nominal', '14 minute estimated wait', 'Secondary Entrance is at 23% utilization'], 'Redirect general-admission attendees to Secondary Entrance.', 'Expected to lower the primary queue within two verification cycles.', now);
  } else if (scenario === 'duplicate_pass') {
    const passIdHash = 'sha256:7ad78a-synthetic-4e92b1';
    await ctx.db.insert('operationalEvents', { eventId: event._id, eventType: 'CHECK_IN', source: 'deterministic-simulator', timestamp: now-32_000, passIdHash, gateId: 'gate-main', payload: {}, simulation: true });
    await ctx.db.insert('operationalEvents', { eventId: event._id, eventType: 'CHECK_IN', source: 'deterministic-simulator', timestamp: now, passIdHash, gateId: 'gate-secondary', payload: {}, simulation: true });
    await createIncident(ctx, event._id, 'DUPLICATE_PASS_ACTIVITY', 'critical', 'Suspicious pass activity', ['Pass …4e92b1 scanned at Main Entrance', 'Repeated at Secondary Entrance after 32 seconds', 'No attendee PII entered the operational plane'], 'Flag this pass hash for manual verification at its next scan.', 'Prevents unauthorized reuse without an automatic access denial.', now);
  } else {
    const session = await ctx.db.query('sessions').withIndex('by_event', q => q.eq('eventId', event._id)).first(); if (!session) throw new Error('Session missing');
    await ctx.db.patch(session._id, { startsAt: now + 18*60_000, speakerStatuses: { 'speaker-maya': 'expected' }, status: 'speaker_at_risk' });
    await ctx.db.insert('operationalEvents', { eventId: event._id, eventType: 'SPEAKER_STATUS', source: 'deterministic-simulator', timestamp: now, sessionId: session.sessionId, speakerId: 'speaker-maya', payload: { status: 'expected' }, simulation: true });
    await createIncident(ctx, event._id, 'SPEAKER_NOT_READY', 'medium', 'Speaker readiness at risk', ['Session begins in 18 minutes', 'Room: Main Stage', 'Required speaker status: not checked in'], 'Notify speaker operations and begin the fallback protocol.', 'Creates time to locate the speaker or prepare a fallback.', now);
  }
  await ctx.db.insert('auditLogs', { eventId: event._id, actor: 'simulator', action: `TRIGGER_${scenario.toUpperCase()}`, entityType: 'scenario', entityId: scenario, timestamp: now, metadata: { simulation: true, seed: 20260906 } });
}});

export const decideRecommendation = mutation({ args: { incidentId: v.id('incidents'), decision: v.union(v.literal('approved'), v.literal('rejected')), actor: v.string() }, handler: async (ctx, args) => {
  const incident = await ctx.db.get(args.incidentId); if (!incident) throw new Error('Incident missing');
  const recommendation = await ctx.db.query('recommendations').withIndex('by_incident', q => q.eq('incidentId', args.incidentId)).unique(); if (!recommendation || recommendation.status !== 'pending') throw new Error('Recommendation is not actionable');
  const now = Date.now(); await ctx.db.patch(recommendation._id, { status: args.decision });
  await ctx.db.patch(incident._id, { status: args.decision === 'approved' ? 'verifying' : 'rejected', updatedAt: now });
  const actionId = await ctx.db.insert('actions', { incidentId: incident._id, recommendationId: recommendation._id, actionType: recommendation.recommendationType, requestedBy: 'liveops-agent', approvedBy: args.actor, status: args.decision === 'approved' ? 'executed' : 'rejected', payload: { constrained: true }, createdAt: now, executedAt: now, result: { decision: args.decision } });
  await ctx.db.insert('auditLogs', { eventId: incident.eventId, actor: args.actor, action: `RECOMMENDATION_${args.decision.toUpperCase()}`, entityType: 'action', entityId: String(actionId), timestamp: now, metadata: { incidentType: incident.incidentType } });
  if (args.decision === 'approved' && incident.incidentType === 'GATE_CONGESTION') {
    const main = await ctx.db.query('gates').withIndex('by_event_gate', q => q.eq('eventId', incident.eventId)).filter(q => q.eq(q.field('gateId'), 'gate-main')).unique();
    const secondary = await ctx.db.query('gates').withIndex('by_event_gate', q => q.eq('eventId', incident.eventId)).filter(q => q.eq(q.field('gateId'), 'gate-secondary')).unique();
    if (main) await ctx.db.patch(main._id, { currentCheckinRate: 28, estimatedWaitMinutes: 4, status: 'healthy', lastUpdatedAt: now });
    if (secondary) await ctx.db.patch(secondary._id, { currentCheckinRate: 22, estimatedWaitMinutes: 3, status: 'healthy', lastUpdatedAt: now });
    await ctx.db.patch(incident._id, { status: 'resolved', updatedAt: now, resolvedAt: now });
  }
}});

async function createIncident(ctx: any, eventId: any, type: string, severity: string, title: string, evidence: string[], recommendation: string, impact: string, now: number) {
  const existing = await ctx.db.query('incidents').withIndex('by_key', (q: any) => q.eq('incidentKey', `${eventId}:${type}`)).first(); if (existing && existing.status !== 'resolved') return existing._id;
  const incidentId = await ctx.db.insert('incidents', { eventId, incidentKey: `${eventId}:${type}:${now}`, incidentType: type, severity, status: 'awaiting_approval', title, summary: evidence[0], evidence, detectedAt: now, updatedAt: now });
  await ctx.db.insert('recommendations', { incidentId, recommendationType: type === 'GATE_CONGESTION' ? 'REDIRECT_TRAFFIC' : type === 'DUPLICATE_PASS_ACTIVITY' ? 'FLAG_PASS' : 'NOTIFY_SPEAKER_OPS', summary: recommendation, rationaleSummary: evidence.join(' · '), expectedImpact: impact, risk: type === 'DUPLICATE_PASS_ACTIVITY' ? 'medium' : 'low', requiresHumanApproval: true, status: 'pending', source: 'policy_fallback', createdAt: now });
  await ctx.db.insert('agentRuns', { incidentId, inputSnapshot: { type, evidence }, toolCalls: ['getIncidentEvidence','getAvailableOperationalActions','requestHumanApproval'], structuredOutput: { severity, summary: title, evidence, recommendedAction: recommendation, expectedImpact: impact, risk: 'low', requiresApproval: true }, model: 'deterministic-policy-fallback', latency: 0, status: 'fallback', createdAt: now });
  return incidentId;
}
