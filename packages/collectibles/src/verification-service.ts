import { toVerificationResponse } from './privacy.js';
import type { ProofVerifier } from './repositories.js';
export class MomentVerificationService { constructor(private verifier: ProofVerifier) {} async verify(proofId: string) { const item = await this.verifier.verify(proofId); if (!item) return { valid:false }; return toVerificationResponse(item.metadata); } }
