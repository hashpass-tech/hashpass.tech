export const momentFlags = {
  enabled: process.env.MOMENTS_ENABLED === 'true',
  claimsEnabled: process.env.MOMENTS_CLAIMS_ENABLED === 'true',
  poapImportEnabled: process.env.MOMENTS_POAP_IMPORT_ENABLED === 'true',
  algorandMintEnabled: process.env.MOMENTS_ALGORAND_MINT_ENABLED === 'true',
  x402Enabled: process.env.MOMENTS_X402_ENABLED === 'true',
};
export function requireMomentsEnabled() { if (!momentFlags.enabled) return Response.json({ error:'HashPass Moments is disabled' }, { status: 404 }); return null; }
