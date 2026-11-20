import { describeStatus } from "@asaase-ani/shared";
import type { StatusTone } from "@asaase-ani/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const TONES: Record<StatusTone, { bg: string; border: string; fg: string }> = {
  progress: { bg: colors.progressTint, border: colors.progressLine, fg: colors.progressInk },
  positive: { bg: colors.brandTint, border: colors.brand, fg: colors.brandDark },
  attention: { bg: colors.warnTint, border: colors.warnLine, fg: "#6b4200" },
  neutral: { bg: colors.neutralTint, border: colors.muted, fg: colors.ink },
};

// The status in words, with a matching colour. Colour is never the only signal.
export function StatusBadge({ status }: { status: string }) {
  const info = describeStatus(status);
  const tone = TONES[info.tone];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  text: { fontSize: 13, fontWeight: "700" },
});
