import { describe, expect, it } from 'vitest';
import { detectDuplicatePass, detectGateCongestion, detectSpeakerReadiness } from './detectors';
import type { Gate, Session } from '../lib/types';

const gate = (overrides: Partial<Gate> = {}): Gate => ({ gateId:'a',name:'Gate A',rate:20,capacity:25,wait:2,status:'healthy',...overrides });
const session = (overrides: Partial<Session> = {}): Session => ({ sessionId:'s',title:'Session',room:'Main',startsIn:30,occupancy:1,capacity:100,speaker:'Speaker',speakerReady:true,...overrides });

describe('operational detectors', () => {
  it('requires throughput, wait pressure, and spare alternative capacity for congestion', () => {
    expect(detectGateCongestion(gate({rate:68,wait:14}),[gate({gateId:'b',name:'Gate B',rate:7,capacity:30})])?.type).toBe('GATE_CONGESTION');
    expect(detectGateCongestion(gate({rate:68,wait:3}),[gate({gateId:'b',rate:7,capacity:30})])).toBeNull();
    expect(detectGateCongestion(gate({rate:68,wait:14}),[gate({gateId:'b',rate:20,capacity:30})])).toBeNull();
  });
  it('detects the same hashed pass at different gates inside the suspicious window', () => {
    const now=100_000;
    expect(detectDuplicatePass({passHash:'hash',gateId:'a',at:now-32_000},{passHash:'hash',gateId:'c',at:now},now)?.type).toBe('DUPLICATE_PASS_ACTIVITY');
    expect(detectDuplicatePass({passHash:'hash',gateId:'a',at:0},{passHash:'hash',gateId:'c',at:100_000},now)).toBeNull();
    expect(detectDuplicatePass({passHash:'hash',gateId:'a',at:0},{passHash:'hash',gateId:'a',at:20_000},now)).toBeNull();
  });
  it('warns only for an imminent session whose required speaker is absent', () => {
    expect(detectSpeakerReadiness(session({startsIn:18,speakerReady:false}))?.type).toBe('SPEAKER_NOT_READY');
    expect(detectSpeakerReadiness(session({startsIn:21,speakerReady:false}))).toBeNull();
    expect(detectSpeakerReadiness(session({startsIn:18,speakerReady:true}))).toBeNull();
  });
  it('stores operator-facing evidence and never chain-of-thought', () => {
    const result=detectSpeakerReadiness(session({startsIn:18,speakerReady:false}));
    expect(result?.evidence).toHaveLength(3); expect(result?.recommendation.rationale).toBeTruthy(); expect(JSON.stringify(result)).not.toContain('chain-of-thought');
  });
});
