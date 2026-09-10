import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const evidence = v.array(v.string());
export default defineSchema({
  events: defineTable({ externalEventId: v.string(), slug: v.string(), name: v.string(), timezone: v.string(), status: v.string(), configuration: v.any() }).index('by_slug', ['slug']),
  gates: defineTable({ eventId: v.id('events'), gateId: v.string(), name: v.string(), status: v.string(), nominalCapacityPerMinute: v.number(), currentCheckinRate: v.number(), estimatedWaitMinutes: v.number(), lastUpdatedAt: v.number() }).index('by_event', ['eventId']).index('by_event_gate', ['eventId', 'gateId']),
  sessions: defineTable({ eventId: v.id('events'), sessionId: v.string(), title: v.string(), room: v.string(), startsAt: v.number(), endsAt: v.number(), capacity: v.number(), currentOccupancy: v.number(), speakerIds: v.array(v.string()), speakerStatuses: v.any(), status: v.string() }).index('by_event', ['eventId']),
  operationalEvents: defineTable({ eventId: v.id('events'), eventType: v.string(), source: v.string(), timestamp: v.number(), passIdHash: v.optional(v.string()), gateId: v.optional(v.string()), sessionId: v.optional(v.string()), speakerId: v.optional(v.string()), payload: v.any(), simulation: v.boolean() }).index('by_event_time', ['eventId', 'timestamp']).index('by_pass_time', ['passIdHash', 'timestamp']),
  incidents: defineTable({ eventId: v.id('events'), incidentKey: v.string(), incidentType: v.string(), severity: v.string(), status: v.string(), title: v.string(), summary: v.string(), evidence, detectedAt: v.number(), updatedAt: v.number(), resolvedAt: v.optional(v.number()) }).index('by_event', ['eventId']).index('by_key', ['incidentKey']),
  recommendations: defineTable({ incidentId: v.id('incidents'), recommendationType: v.string(), summary: v.string(), rationaleSummary: v.string(), expectedImpact: v.string(), risk: v.string(), requiresHumanApproval: v.boolean(), status: v.string(), source: v.string(), createdAt: v.number() }).index('by_incident', ['incidentId']),
  actions: defineTable({ incidentId: v.id('incidents'), recommendationId: v.id('recommendations'), actionType: v.string(), requestedBy: v.string(), approvedBy: v.optional(v.string()), status: v.string(), payload: v.any(), createdAt: v.number(), executedAt: v.optional(v.number()), result: v.optional(v.any()) }).index('by_incident', ['incidentId']),
  agentRuns: defineTable({ incidentId: v.id('incidents'), inputSnapshot: v.any(), toolCalls: v.array(v.string()), structuredOutput: v.any(), model: v.string(), latency: v.number(), status: v.string(), createdAt: v.number() }).index('by_incident', ['incidentId']),
  auditLogs: defineTable({ eventId: v.id('events'), actor: v.string(), action: v.string(), entityType: v.string(), entityId: v.string(), timestamp: v.number(), metadata: v.any() }).index('by_event_time', ['eventId', 'timestamp']),
  simulatorRuns: defineTable({ eventId: v.id('events'), scenario: v.string(), seed: v.number(), status: v.string(), startedAt: v.number(), completedAt: v.optional(v.number()) }).index('by_event', ['eventId']),
});
