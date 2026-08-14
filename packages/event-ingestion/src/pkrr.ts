import { normalizedEventSchema, type EventSource, type NormalizedEvent } from "./schema.js";

export const PKRR_SOURCE: EventSource = {
  sourceId: "pkrr-hash-poker", sourceName: "PKRR / Hash Poker Room", sourceType: "hybrid",
  baseUrl: "https://pkrr.io/c/hash-poker", pollingIntervalMinutes: 60, parserStrategy: "pkrr-next-html", active: true,
};

const text = (value: string) => value.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const attr = (html: string, name: string) => html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "";
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function localIso(date: string, displayedTime: string): string {
  const clean = displayedTime.toLowerCase().replace(/\s/g, " ");
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (!match) throw new Error(`Invalid PKRR time: ${displayedTime}`);
  let hour = Number(match[1]); const minute = Number(match[2] || 0); const meridiem = match[3]?.replace(/[.\s]/g, "");
  if (meridiem === "pm" && hour < 12) hour += 12; if (meridiem === "am" && hour === 12) hour = 0;
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`;
}

export function parsePkrrHtml(html: string, now = new Date()): NormalizedEvent[] {
  const blocks = [...html.matchAll(/<div[^>]+class=["']wp-day-row["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["']wp-day-row["']|<\/main>)/gi)];
  // Next.js RSC includes canonical YYYY-MM-DD keys even though the rendered
  // timeline only displays localized labels such as "14 de agosto".
  const canonicalDates = [...new Set([...html.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map(match => match[0]))];
  const createdAt = now.toISOString(); const events: NormalizedEvent[] = [];
  for (const [blockIndex, blockMatch] of blocks.entries()) {
    const block = blockMatch[1];
    const date = block.match(/(?:data-date=["']|<div[^>]+class=["']wp-day-row["'][^>]*)(\d{4}-\d{2}-\d{2})/)?.[1]
      || blockMatch[0].match(/(\d{4}-\d{2}-\d{2})/)?.[1] || canonicalDates[blockIndex];
    const cards = [...block.matchAll(/<a[^>]+class=["']wp-ev["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<a[^>]+class=["']wp-ev["']|$)/gi)];
    for (const card of cards) {
      if (!date) continue;
      const body = card[2]; const path = card[1];
      const title = text(body.match(/class=["']wp-ev-title["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
      const time = text(body.match(/class=["']wp-ev-time["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] || "");
      if (!title || !time) continue;
      const externalId = path.split("/").filter(Boolean).pop()!;
      const description = text(body.match(/class=["']wp-ev-short["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
      const venueName = text(body.match(/class=["']row["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] || "Hash House Club");
      const imagePath = attr(body.match(/<img[^>]+>/i)?.[0] || "", "src");
      const startsAt = localIso(date, time);
      events.push(normalizedEventSchema.parse({
        id: `pkrr:${externalId}`, sourceId: PKRR_SOURCE.sourceId, externalId, slug: `hash-poker-${slugify(title)}-${date}`,
        title, description, eventType: /main event/i.test(title) ? "community_tournament" : "poker_room_event",
        startsAt, endsAt: null, timezone: "America/Bogota", venueName, address: "Provenza, El Poblado",
        city: "Medellín", country: "Colombia", coverImage: imagePath ? new URL(imagePath, PKRR_SOURCE.baseUrl).href : null,
        sourceUrl: new URL(path, PKRR_SOURCE.baseUrl).href, organizerName: "Hash Poker Room", organizerLogo: "https://pkrr.io/club-headers/hash-poker-1780960689943.jpg",
        recurrence: { frequency: "weekly", interval: 1, weekdays: [new Date(`${date}T12:00:00Z`).getUTCDay()] },
        status: Date.parse(startsAt) >= now.getTime() ? "upcoming" : "past", tags: ["Weekly Poker Room", "Community Tournament", "Medellín"],
        agenda: [{ id: `${externalId}-arrival`, time, title: "Member arrival and QR check-in", type: "registration" }, { id: `${externalId}-start`, time, title: title, type: "community_event" }],
        speakers: [], sponsors: [], benefits: ["Member smart pass", "Attendance history", "Community networking"], networkingEnabled: true, checkinEnabled: true,
        cta: { label: "Reserve seat", url: new URL(path, PKRR_SOURCE.baseUrl).href }, createdAt, updatedAt: createdAt,
        rawPayload: { path, date, time }, confidence: description && imagePath ? 0.95 : 0.78, needsReview: !(description && imagePath),
      }));
    }
  }
  return events;
}
