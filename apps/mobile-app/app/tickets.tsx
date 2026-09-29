import React from "react";
import { ScrollView } from "react-native";
import BslTicketsExperience from "../components/bsl/BslTicketsExperience";

export default function TicketsPage() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <BslTicketsExperience fullPage />
    </ScrollView>
  );
}
