import type { AttendanceCredential } from './types.js';
const precedence = ['hashpass_check_in','authorized_scan_log','pass_consumed_checkpoint','verified_event_role','organizer_approved','imported_authoritative_list'];
export function selectBestCredential(credentials: AttendanceCredential[]): AttendanceCredential | null { return credentials.filter(c => c.attendanceStatus === 'verified').sort((a,b) => precedence.indexOf(a.verificationMethod) - precedence.indexOf(b.verificationMethod))[0] ?? null; }
export function isCampaignOpen(now: string, start?: string, end?: string): boolean { const t = Date.parse(now); return (!start || t >= Date.parse(start)) && (!end || t <= Date.parse(end)); }
