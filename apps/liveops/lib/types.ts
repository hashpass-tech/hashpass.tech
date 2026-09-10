export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentType = 'GATE_CONGESTION' | 'DUPLICATE_PASS_ACTIVITY' | 'SPEAKER_NOT_READY';
export type IncidentStatus = 'detected' | 'awaiting_approval' | 'actioned' | 'verifying' | 'resolved' | 'rejected';
export interface Gate { gateId: string; name: string; rate: number; capacity: number; wait: number; status: 'healthy' | 'watch' | 'congested'; }
export interface Session { sessionId: string; title: string; room: string; startsIn: number; occupancy: number; capacity: number; speaker: string; speakerReady: boolean; }
export interface Recommendation { summary: string; rationale: string; impact: string; risk: 'low' | 'medium' | 'high'; source: 'policy_fallback' | 'agent'; status: 'pending' | 'approved' | 'rejected'; }
export interface Incident { id: string; type: IncidentType; severity: Severity; status: IncidentStatus; title: string; summary: string; evidence: string[]; detectedAt: number; recommendation: Recommendation; }
export interface AuditEntry { id: string; at: number; actor: string; action: string; detail: string; }
