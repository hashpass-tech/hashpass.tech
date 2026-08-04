import type {
  EventContext,
  NetworkingProfile,
  PassEntitlements,
  QRConsumeResult,
} from "@hashpass/x402-event-agent";
import { getSupabaseServerForRequest } from "@/lib/supabase-server";
export async function loadEventContext(
  request: Request,
  eventId: string,
): Promise<EventContext | null> {
  const db = getSupabaseServerForRequest(request);
  const [{ data: event }, { data: agenda, error }, { data: speakers }] =
    await Promise.all([
      db.from("events").select("id,name").eq("id", eventId).maybeSingle(),
      db.from("event_agenda").select("*").eq("event_id", eventId).order("time"),
      db
        .from("bsl_speakers")
        .select("id,name,title,company,bio")
        .eq("is_active", true),
    ]);
  if (error || !event) return null;
  return {
    id: String(event.id),
    name: String(event.name),
    sessions: (agenda || []).map((x: any) => ({
      id: String(x.id),
      title: String(x.title || x.name || "Session"),
      description: x.description,
      category: x.type || x.category,
      language: x.language,
      startsAt: String(x.starts_at || x.start_time || x.time),
      endsAt: String(x.ends_at || x.end_time || x.time_end || x.time),
      location: x.location || x.room,
      speakerIds: (x.speaker_ids || []).map(String),
      requiredEntitlement: x.required_entitlement,
    })),
    speakers: (speakers || []).map((x: any) => ({
      id: String(x.id),
      displayName: String(x.name),
      role: x.title,
      company: x.company,
      topics: String(x.bio || "")
        .split(/[,.;]/)
        .filter(Boolean)
        .slice(0, 12),
    })),
  };
}
export async function loadPass(
  request: Request,
  eventId: string,
  reference?: string,
): Promise<PassEntitlements> {
  if (!reference)
    return { benefits: [], entitlements: [], meetingRequestAllowed: false };
  const db = getSupabaseServerForRequest(request);
  const { data } = await db
    .from("passes")
    .select("pass_type,features,benefits,status")
    .eq("event_id", eventId)
    .eq("pass_number", reference)
    .eq("status", "active")
    .maybeSingle();
  return {
    tier: data?.pass_type,
    benefits: Array.isArray(data?.benefits) ? data.benefits : [],
    entitlements: Array.isArray(data?.features) ? data.features : [],
    meetingRequestAllowed: Boolean(
      data &&
      Array.isArray(data.features) &&
      data.features.includes("networking"),
    ),
  };
}
export async function loadNetworking(
  request: Request,
  eventId: string,
): Promise<NetworkingProfile[]> {
  const db = getSupabaseServerForRequest(request);
  const { data } = await db
    .from("bsl_speakers")
    .select("id,name,title,company,bio,is_active")
    .eq("is_active", true);
  return (data || []).map((x: any) => ({
    profileId: String(x.id),
    displayName: String(x.name),
    role: x.title,
    company: x.company,
    interests: String(x.bio || "")
      .split(/[,.;]/)
      .map((v: string) => v.trim().toLowerCase())
      .filter(Boolean),
    offers: [],
    seeks: [],
    visible: true,
    eventId,
  }));
}
export async function consumeQR(
  request: Request,
  input: {
    eventId: string;
    token: string;
    checkpointId: string;
    deviceId?: string;
  },
): Promise<QRConsumeResult> {
  const db = getSupabaseServerForRequest(request);
  const { data, error } = await db
    .rpc("validate_and_use_qr", {
      p_token: input.token,
      p_scanner_user_id: null,
      p_scanner_device_id: input.deviceId || null,
    })
    .single();
  if (error) throw error;
  const r = data as any;
  if (!r) return { valid: false, status: "not_found" };
  const qrEvent = String(r.qr_data?.event_id || r.event_id || "");
  if (r.valid && qrEvent && qrEvent !== input.eventId)
    return { valid: false, status: "event_mismatch" };
  const map: Record<string, QRConsumeResult["status"]> = {
    invalid: "not_found",
    already_used: "already_used",
    expired: "expired",
    revoked: "revoked",
    suspended: "suspended",
    limit_reached: "limit_reached",
    valid: "checked_in",
  };
  return {
    valid: Boolean(r.valid),
    status: map[r.status] || "invalid",
    eventId: qrEvent || input.eventId,
    passTier: r.qr_data?.pass_tier || r.display_data?.pass_type,
    checkedInAt: r.used_at || new Date().toISOString(),
    qrReference: r.qr_id ? String(r.qr_id) : undefined,
  };
}
