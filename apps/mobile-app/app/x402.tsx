import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  Pressable,
  View,
  StyleSheet,
} from "react-native";
const api =
  (globalThis as any)?.location?.origin || "https://api-dev.hashpass.tech";
export default function X402Showcase() {
  const [event, setEvent] = useState("chile2026");
  const [result, setResult] = useState(
    "Select an experience to receive its x402 payment requirement.",
  );
  const call = async (path: string, body: unknown) => {
    setResult("Requesting payment requirements…");
    try {
      const r = await fetch(`${api}/api/x402/events/${event}/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      setResult(
        r.status === 402
          ? `Payment required on ${json.accepts?.[0]?.network || "Algorand"} · USDC asset ${json.accepts?.[0]?.asset}`
          : JSON.stringify(json, null, 2),
      );
    } catch {
      setResult("The development API is unavailable. No payment was created.");
    }
  };
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.tag}>ALGORAND TESTNET · x402-global-challenge</Text>
      <Text style={s.hero}>Plan → Connect → Attend → Prove</Text>
      <Text style={s.lead}>
        HashPass turns event intelligence and trusted entry into
        agent-accessible, pay-per-request services.
      </Text>
      <Text style={s.label}>Event</Text>
      <TextInput value={event} onChangeText={setEvent} style={s.input} />
      <Card
        title="Plan My Event"
        price="0.02 USDC"
        copy="Build a personalized, conflict-free event agenda."
        onPress={() =>
          call("concierge", {
            interests: ["AI", "stablecoins"],
            goals: ["meet investors"],
            availableFrom: "10:00",
            availableUntil: "17:00",
            preferredLanguages: ["en", "es"],
          })
        }
      />
      <Card
        title="Find My Best Connections"
        price="0.02 USDC"
        copy="Pay once. Discover the three conversations that could change your event."
        onPress={() =>
          call("networking/match", {
            interests: ["event technology"],
            goals: ["find partners"],
            seeks: ["investment"],
            limit: 3,
          })
        }
      />
      <Card
        title="Verify My Entry"
        price="0.01 USDC"
        copy="One payment. One verified entry. One tamper-evident proof."
        onPress={() =>
          call("check-in", {
            token: "DEMO-TOKEN-NOT-A-REAL-CREDENTIAL",
            checkpointId: "demo-checkpoint",
          })
        }
      />
      <View style={s.result}>
        <Text style={s.resultTitle}>Payment state / service result</Text>
        <Text style={s.code}>{result}</Text>
      </View>
      <Text style={s.privacy}>
        Privacy by design: only event-scoped public profiles are eligible.
        HashPass never returns emails, phone numbers, raw user IDs, payment
        secrets, or complete QR records.
      </Text>
      <Text style={s.disclaimer}>
        Competition demonstration. Testnet assets have no monetary value.
        Mainnet and production check-in remain disabled until explicitly
        approved.
      </Text>
    </ScrollView>
  );
}
function Card(p: {
  title: string;
  price: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.cardTitle}>{p.title}</Text>
        <Text style={s.price}>{p.price}</Text>
      </View>
      <Text style={s.copy}>{p.copy}</Text>
      <Pressable style={s.button} onPress={p.onPress}>
        <Text style={s.buttonText}>Request service</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#07111f" },
  content: {
    maxWidth: 920,
    width: "100%",
    alignSelf: "center",
    padding: 28,
    gap: 18,
  },
  tag: { color: "#68e0b4", fontWeight: "800", letterSpacing: 1 },
  hero: { color: "white", fontSize: 46, fontWeight: "900", lineHeight: 52 },
  lead: { color: "#bac7d8", fontSize: 19, lineHeight: 29, maxWidth: 760 },
  label: { color: "#dbe5f2", fontWeight: "700" },
  input: {
    backgroundColor: "#111f30",
    borderColor: "#29415f",
    borderWidth: 1,
    borderRadius: 10,
    color: "white",
    padding: 14,
  },
  card: {
    backgroundColor: "#101d2d",
    borderColor: "#243b57",
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  cardTitle: { color: "white", fontWeight: "800", fontSize: 23 },
  price: { color: "#68e0b4", fontWeight: "800" },
  copy: { color: "#b9c7d8", fontSize: 16 },
  button: {
    backgroundColor: "#ef476f",
    padding: 13,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  buttonText: { color: "white", fontWeight: "800" },
  result: {
    backgroundColor: "#050b12",
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  resultTitle: { color: "white", fontWeight: "800" },
  code: { color: "#9fd9c4", fontFamily: "monospace", lineHeight: 20 },
  privacy: { color: "#cad6e5", lineHeight: 22 },
  disclaimer: { color: "#7f92a9", fontSize: 12, lineHeight: 18 },
});
