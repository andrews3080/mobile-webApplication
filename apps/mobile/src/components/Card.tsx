import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title && (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 },
});
