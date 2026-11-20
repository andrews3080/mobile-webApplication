import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, minTouch } from "../theme";

export type ButtonTone = "primary" | "positive" | "danger" | "neutral" | "secondary";

interface Props {
  label: string;
  onPress(): void;
  tone?: ButtonTone;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FILL: Record<ButtonTone, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.brandInk, border: colors.brand },
  positive: { bg: colors.brand, fg: colors.brandInk, border: colors.brand },
  danger: { bg: colors.danger, fg: colors.brandInk, border: colors.danger },
  neutral: { bg: colors.card, fg: colors.brand, border: colors.brand },
  secondary: { bg: colors.card, fg: colors.brand, border: colors.brand },
};

export function Button({ label, onPress, tone = "primary", busy = false, disabled = false, style }: Props) {
  const fill = FILL[tone];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill.bg, borderColor: fill.border, opacity: off ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy && <ActivityIndicator color={fill.fg} style={styles.spinner} />}
      <Text style={[styles.label, { color: fill.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouch,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 16, fontWeight: "700" },
  spinner: { marginRight: 8 },
});
