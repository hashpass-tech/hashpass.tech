import React from "react";
import { WebView } from "react-native-webview";

export const BSL_TICKETS_URL = "https://tik-bsl.vercel.app/e/bsl-colombia-2026";

export default function TicketCheckoutFrame({ title }: { title: string }) {
  return (
    <WebView
      source={{ uri: BSL_TICKETS_URL }}
      style={{ flex: 1, minHeight: 640 }}
      accessibilityLabel={title}
      startInLoadingState
    />
  );
}
