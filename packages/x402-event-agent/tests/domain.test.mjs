import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConcierge,
  findNetworkingMatches,
  checkIn,
  redactSensitive,
} from "../dist/index.js";
const event = {
  id: "chile2026",
  name: "Chile",
  sessions: [
    {
      id: "ai",
      title: "AI stablecoin infrastructure",
      startsAt: "10:00",
      endsAt: "11:00",
      speakerIds: ["s"],
    },
    { id: "other", title: "Opening", startsAt: "10:30", endsAt: "11:30" },
    { id: "late", title: "Fundraising", startsAt: "18:00", endsAt: "19:00" },
  ],
  speakers: [{ id: "s", displayName: "Ada", topics: ["AI"] }],
};
const passes = {
  getEntitlements: async () => ({
    benefits: ["lounge"],
    entitlements: [],
    meetingRequestAllowed: true,
  }),
};
test("concierge ranks matches, respects window and removes conflicts", async () => {
  const r = await buildConcierge(
    "chile2026",
    {
      interests: ["AI", "stablecoin"],
      goals: [],
      availableFrom: "09:00",
      availableUntil: "17:00",
    },
    {
      events: { getEvent: async () => event },
      passes,
      requestId: () => "r",
      now: () => new Date(0),
    },
  );
  assert.deepEqual(
    r.recommendedAgenda.map((x) => x.sessionId),
    ["ai"],
  );
  assert.equal(r.alternatives[0].sessionId, "other");
  assert.ok(!JSON.stringify(r).includes("late"));
});
test("networking filters visibility, scope and limit", async () => {
  const p = (id, visible, eventId = "e") => ({
    profileId: id,
    displayName: id,
    interests: ["ai"],
    offers: ["investment"],
    seeks: [],
    visible,
    eventId,
  });
  const r = await findNetworkingMatches(
    "e",
    { interests: ["ai"], goals: [], seeks: ["investment"], limit: 1 },
    {
      networking: {
        listVisibleProfiles: async () => [
          p("best", true),
          p("private", false),
          p("wrong", true, "x"),
        ],
      },
      passes,
      requestId: () => "r",
      now: () => new Date(0),
    },
  );
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].profileId, "best");
  assert.ok(r.matches[0].whyMeet);
});
test("unknown qr stays invalid and database errors fail closed", async () => {
  const input = { token: "secret", checkpointId: "door" };
  assert.equal(
    (
      await checkIn("e", input, {
        qr: { consume: async () => ({ valid: false, status: "not_found" }) },
      })
    ).status,
    "not_found",
  );
  assert.equal(
    (
      await checkIn("e", input, {
        qr: {
          consume: async () => {
            throw Error();
          },
        },
      })
    ).status,
    "database_error",
  );
});
test("privacy removes sensitive nested fields", () =>
  assert.deepEqual(
    redactSensitive({
      name: "A",
      email: "x",
      nested: { token: "y", role: "r" },
    }),
    { name: "A", nested: { role: "r" } },
  ));
