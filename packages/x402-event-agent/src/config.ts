export type X402Config = {
  enabled: boolean;
  network: string;
  assetId: string;
  payTo: string;
  facilitatorUrl: string;
  challengeTag: string;
  prices: {
    ping: string;
    concierge: string;
    networking: string;
    checkIn: string;
  };
};
export function loadX402Config(
  env: Record<string, string | undefined>,
): X402Config {
  return {
    enabled: env.X402_ENABLED === "true",
    network: env.X402_NETWORK || "algorand:testnet",
    assetId: env.X402_ASSET_ID || "10458941",
    payTo: env.X402_PAY_TO || "",
    facilitatorUrl: env.X402_FACILITATOR_URL || "https://x402.goplausible.xyz",
    challengeTag: env.X402_CHALLENGE_TAG || "x402-global-challenge",
    prices: {
      ping: env.X402_PING_PRICE_USDC || "0.01",
      concierge: env.X402_CONCIERGE_PRICE_USDC || "0.02",
      networking: env.X402_NETWORKING_PRICE_USDC || "0.02",
      checkIn: env.X402_CHECKIN_PRICE_USDC || "0.01",
    },
  };
}
