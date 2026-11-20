import { categoryLabel, describeStatus, formatDate, isSessionEnded, officerErrorMessage } from "@asaase-ani/shared";
import type { OfficerApi, OfficerReportSummary } from "@asaase-ani/shared";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { colors, minTouch, radius } from "../theme";

interface Props {
  api: OfficerApi;
  token: string;
  filter: string | null;
  onFilter(status: string | null): void;
  onOpen(code: string): void;
  onSessionEnded(): void;
}

// Work order: what needs attention first
const STATUS_ORDER = ["received", "under_review", "more_information_requested", "verified", "rejected", "referred_for_action", "closed"];

export function ReportListScreen({ api, token, filter: chosen, onFilter, onOpen, onSessionEnded }: Props) {
  const [reports, setReports] = useState<OfficerReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReports(await api.listReports(token));
    } catch (failure) {
      if (isSessionEnded(failure)) onSessionEnded();
      else setError(officerErrorMessage(failure));
    }
  }, [api, token, onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const counts = new Map<string, number>();
  for (const report of reports ?? []) counts.set(report.status, (counts.get(report.status) ?? 0) + 1);
  const statuses = [...STATUS_ORDER.filter((s) => counts.has(s)), ...[...counts.keys()].filter((s) => !STATUS_ORDER.includes(s))];
  const filter = chosen !== null && counts.has(chosen) ? chosen : null; // a status can vanish after a refresh
  const shown = (reports ?? []).filter((r) => filter === null || r.status === filter);

  const chip = (value: string | null, label: string, count: number) => {
    const on = filter === value;
    return (
      <Pressable
        key={value ?? "all"}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}, ${count} reports`}
        onPress={() => onFilter(value)}
        style={[styles.chip, on && styles.chipOn]}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>
          {label} <Text style={styles.chipCount}>{count}</Text>
        </Text>
      </Pressable>
    );
  };

  if (reports === null) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
            <Button label="Try again" tone="secondary" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.brand} accessibilityLabel="Loading reports" />
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={shown}
      keyExtractor={(r) => r.reference}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[colors.brand]} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.h1} accessibilityRole="header">
            Reports in your areas
          </Text>
          <Text style={styles.hint}>Pull down to refresh.</Text>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {reports.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chip(null, "All", reports.length)}
              {statuses.map((s) => chip(s, describeStatus(s).label, counts.get(s) ?? 0))}
            </ScrollView>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No reports in your areas yet.</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Report ${item.reference}, ${describeStatus(item.status).label}, ${categoryLabel(item.category)}, ${item.area}`}
          onPress={() => onOpen(item.reference)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowTop}>
            <Text style={styles.code}>{item.reference}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.what}>{categoryLabel(item.category)}</Text>
          <View style={styles.rowTop}>
            <Text style={styles.muted}>{item.area}</Text>
            <Text style={styles.muted}>{formatDate(item.submittedAt)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  list: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink },
  hint: { color: colors.muted, fontSize: 15, marginTop: 2, marginBottom: 12 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  chipTextOn: { color: colors.brandInk },
  chipCount: { fontWeight: "800" },
  row: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius,
    padding: 14,
    marginBottom: 10,
    minHeight: minTouch,
    gap: 6,
  },
  rowPressed: { backgroundColor: colors.brandTint },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  code: { fontFamily: "monospace", fontSize: 16, fontWeight: "700", color: colors.ink, letterSpacing: 0.5 },
  what: { fontSize: 16, fontWeight: "600", color: colors.ink },
  muted: { color: colors.muted, fontSize: 14 },
  empty: { textAlign: "center", color: colors.muted, fontSize: 16, padding: 24 },
  error: { color: colors.danger, fontWeight: "600", fontSize: 16, marginBottom: 8, textAlign: "center" },
});
