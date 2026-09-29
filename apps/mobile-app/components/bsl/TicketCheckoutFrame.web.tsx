import React from "react";
import { View } from "react-native";

export const BSL_TICKETS_URL = "https://tik-bsl.vercel.app/e/bsl-colombia-2026";

export default function TicketCheckoutFrame({ title }: { title: string }) {
  return (
    <View style={{ width: "100%", minHeight: 760, flex: 1 }}>
      <iframe
        src={BSL_TICKETS_URL}
        title={title}
        loading="lazy"
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 760,
          border: 0,
          display: "block",
        }}
      />
    </View>
  );
}
