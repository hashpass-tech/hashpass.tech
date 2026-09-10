import type { Gate, Incident, Session } from '../lib/types';

export const DEFAULT_POLICY = { congestionUtilization: 1.6, congestionWaitMinutes: 8, duplicateWindowMs: 90_000, speakerWarningMinutes: 20 };

export function detectGateCongestion(gate: Gate, alternatives: Gate[], now = Date.now()): Incident | null {
  const utilization = gate.rate / gate.capacity;
  const alternative = alternatives.find((candidate) => candidate.gateId !== gate.gateId && candidate.rate / candidate.capacity < 0.5);
  if (utilization < DEFAULT_POLICY.congestionUtilization || gate.wait < DEFAULT_POLICY.congestionWaitMinutes || !alternative) return null;
  return incident('GATE_CONGESTION', 'high', `${gate.name} congestion detected`, `${gate.name} is operating at ${Math.round(utilization * 100)}% of nominal throughput.`, [
    `${gate.rate} scans/min vs ${gate.capacity} nominal`, `${gate.wait} minute estimated wait`, `${alternative.name} is at ${Math.round(alternative.rate / alternative.capacity * 100)}% utilization`,
  ], 'Redirect general-admission attendees to Secondary Entrance.', `Routing is constrained to an approved action and uses ${alternative.name}'s available capacity.`, 'Expected to lower the primary entrance queue within two verification cycles.', now);
}

export function detectDuplicatePass(first: { passHash: string; gateId: string; at: number }, second: { passHash: string; gateId: string; at: number }, now = Date.now()): Incident | null {
  if (first.passHash !== second.passHash || first.gateId === second.gateId || Math.abs(second.at - first.at) > DEFAULT_POLICY.duplicateWindowMs) return null;
  return incident('DUPLICATE_PASS_ACTIVITY', 'critical', 'Suspicious pass activity', 'One privacy-safe pass hash appeared at different entrances within an impossible travel interval.', [`Pass …${first.passHash.slice(-6)} scanned at ${first.gateId}`, `Repeated at ${second.gateId} after ${Math.round(Math.abs(second.at-first.at)/1000)} seconds`, 'No attendee PII entered the operational plane'], 'Flag this pass hash for manual verification at its next scan.', 'A human confirms the restriction; LiveOps never exposes or mutates attendee identity.', 'Prevents unauthorized reuse while avoiding an automatic access denial.', now);
}

export function detectSpeakerReadiness(session: Session, now = Date.now()): Incident | null {
  if (session.startsIn > DEFAULT_POLICY.speakerWarningMinutes || session.speakerReady) return null;
  return incident('SPEAKER_NOT_READY', 'medium', 'Speaker readiness at risk', `${session.speaker} has not checked in for an imminent session.`, [`${session.title} begins in ${session.startsIn} minutes`, `Room: ${session.room}`, 'Required speaker status: not checked in'], 'Notify speaker operations and begin the documented fallback protocol.', 'Only the stage manager is notified; schedule changes remain operator-controlled.', 'Creates time to locate the speaker or prepare the session fallback.', now);
}

function incident(type: Incident['type'], severity: Incident['severity'], title: string, summary: string, evidence: string[], recommendation: string, rationale: string, impact: string, detectedAt: number): Incident {
  return { id: `${type}-${detectedAt}`, type, severity, status: 'awaiting_approval', title, summary, evidence, detectedAt, recommendation: { summary: recommendation, rationale, impact, risk: type === 'DUPLICATE_PASS_ACTIVITY' ? 'medium' : 'low', source: 'policy_fallback', status: 'pending' } };
}
