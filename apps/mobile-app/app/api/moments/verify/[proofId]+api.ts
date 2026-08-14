import { getSupabaseServerForRequest } from '@/lib/supabase-server';
import { toVerificationResponse } from '@/lib/moments/core';
import { verifyProof } from '@/lib/moments/supabase-repository';
export async function GET(request: Request, context: { params: { proofId: string } }) { const row = await verifyProof(getSupabaseServerForRequest(request), context.params.proofId); if (!row || row.revoked_at) return Response.json({ valid:false }, { status: row ? 200 : 404 }); return Response.json(toVerificationResponse(row.metadata)); }
