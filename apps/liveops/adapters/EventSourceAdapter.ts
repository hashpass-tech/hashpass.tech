import type { Session } from '../lib/types';

export interface EventSourceAdapter {
  getEvent(eventSlug: string): Promise<{ externalEventId: string; slug: string; name: string; timezone: string }>;
  getSchedule(eventSlug: string): Promise<Session[]>;
  getSpeakers(eventSlug: string): Promise<Array<{ id: string; name: string }>>;
  ingestCheckIn(input: { eventId: string; gateId: string; passIdHash: string; simulation: boolean }): Promise<void>;
}

/** Safe demo adapter. Production APIs remain the system of record; only sanitized domain context crosses this boundary. */
export class DemoEventSourceAdapter implements EventSourceAdapter {
  async getEvent(eventSlug: string) { return { externalEventId: 'bsl-bogota-2026-demo', slug: eventSlug, name: 'BSL Bogotá 2026 Demo', timezone: 'America/Bogota' }; }
  async getSchedule() { return [{ sessionId: 'session-main-01', title: 'Programmable trust in the real world', room: 'Main Stage', startsIn: 42, occupancy: 428, capacity: 600, speaker: 'Dr. Maya Torres', speakerReady: true }]; }
  async getSpeakers() { return [{ id: 'speaker-maya', name: 'Dr. Maya Torres' }]; }
  async ingestCheckIn() { /* Convex mutation is supplied by the runtime integration. */ }
}
