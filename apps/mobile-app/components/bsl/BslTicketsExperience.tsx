import { ActionButton, Badge, Surface } from "@hashpass/ui/primitives";
import { uiPalette, uiTokens } from "@hashpass/ui/tokens";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { getCurrentLocale } from "../../i18n/i18n";
import TicketCheckoutFrame, { BSL_TICKETS_URL } from "./TicketCheckoutFrame";

type Props = { fullPage?: boolean };

const copy = {
  es: {
    badge: "Boletería oficial",
    title: "Entradas BSL Colombia 2026",
    intro: "Compra tu entrada oficial sin salir de HASHPASS.",
    companion:
      "HASHPASS es la aplicación companion oficial de BSL Colombia 2026. Cada entrada adquirida garantiza también un pase digital HASHPASS, que conecta tu acceso con la experiencia del evento.",
    frameTitle: "Boletería oficial de BSL Colombia 2026",
    open: "Abrir boletería oficial",
    page: "Ver página de entradas",
    back: "Volver al inicio",
    help: "Si la boletería no carga, ábrela directamente en una nueva ventana.",
  },
  en: {
    badge: "Official ticketing",
    title: "BSL Colombia 2026 tickets",
    intro: "Buy your official ticket without leaving HASHPASS.",
    companion:
      "HASHPASS is the official companion app for BSL Colombia 2026. Every ticket purchased also guarantees a HASHPASS digital pass, connecting your admission to the event experience.",
    frameTitle: "Official BSL Colombia 2026 ticketing",
    open: "Open official ticketing",
    page: "View tickets page",
    back: "Back to home",
    help: "If ticketing does not load, open it directly in a new window.",
  },
} as const;

export default function BslTicketsExperience({ fullPage = false }: Props) {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";
  const palette = uiPalette(mode);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const locale = getCurrentLocale().toLowerCase().startsWith("es")
    ? "es"
    : "en";
  const text = copy[locale];

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: palette.canvas },
        fullPage && {
          flex: 1,
          paddingTop: Math.max(insets.top, uiTokens.space.xl),
        },
      ]}
      testID="bsl-ticketing"
    >
      <View style={[styles.content, fullPage && styles.fullPageContent]}>
        <View style={styles.heading}>
          <Badge mode={mode}>{text.badge}</Badge>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: palette.text }]}
          >
            {text.title}
          </Text>
          <Text style={[styles.intro, { color: palette.muted }]}>
            {text.intro}
          </Text>
          <Text style={[styles.companion, { color: palette.text }]}>
            {text.companion}
          </Text>
          <View style={styles.actions}>
            {!fullPage ? (
              <ActionButton
                mode={mode}
                label={text.page}
                onPress={() => router.push("/tickets" as never)}
              />
            ) : (
              <ActionButton
                mode={mode}
                variant="secondary"
                label={text.back}
                onPress={() => router.push("/home" as never)}
              />
            )}
            <ActionButton
              mode={mode}
              variant="ghost"
              label={text.open}
              onPress={() => Linking.openURL(BSL_TICKETS_URL)}
            />
          </View>
        </View>

        <Surface
          mode={mode}
          style={[styles.frameSurface, fullPage && styles.fullPageFrame]}
        >
          <TicketCheckoutFrame title={text.frameTitle} />
        </Surface>
        <Text style={[styles.help, { color: palette.muted }]}>{text.help}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    paddingHorizontal: uiTokens.space.lg,
    paddingVertical: uiTokens.space.hero,
  },
  content: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    gap: uiTokens.space.xl,
  },
  fullPageContent: { flex: 1 },
  heading: { alignItems: "center", gap: uiTokens.space.md },
  title: {
    fontSize: uiTokens.type.display,
    lineHeight: 48,
    fontWeight: "800",
    textAlign: "center",
  },
  intro: { fontSize: uiTokens.type.body, lineHeight: 24, textAlign: "center" },
  companion: {
    maxWidth: 760,
    fontSize: uiTokens.type.body,
    lineHeight: 26,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: uiTokens.space.md,
    marginTop: uiTokens.space.sm,
  },
  frameSurface: { padding: 0, overflow: "hidden", minHeight: 760 },
  fullPageFrame: { flex: Platform.OS === "web" ? undefined : 1 },
  help: {
    fontSize: uiTokens.type.caption,
    lineHeight: 18,
    textAlign: "center",
  },
});
