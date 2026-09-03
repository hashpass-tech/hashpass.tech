import { getEventSupabaseProfileId } from "../../lib/server/event-supabase-profile";

describe("event Supabase profile selection", () => {
  it("keeps the CriptoLatinFest demo tenant on the BSL development database", () => {
    expect(
      getEventSupabaseProfileId(
        new Request("https://api-dev.hashpass.tech/api/events/criptolatinfest/auth-allies"),
        "criptolatinfest",
      ),
    ).toBe("bsl-development");
  });

  it("keeps the Bitcoin Medellín proposal on the BSL development database even through the production API", () => {
    expect(
      getEventSupabaseProfileId(
        new Request("https://api.hashpass.tech/api/events/btcmedellin2027/auth-allies"),
        "btcmedellin2027",
      ),
    ).toBe("bsl-development");
  });

  it("uses the BSL production profile for an on-tour event on the production host", () => {
    expect(
      getEventSupabaseProfileId(
        new Request("https://api.hashpass.tech/api/events/chile2026/auth-allies"),
        "chile2026",
      ),
    ).toBe("bsl-production");
  });
});
