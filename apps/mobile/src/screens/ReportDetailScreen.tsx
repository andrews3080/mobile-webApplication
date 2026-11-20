import {
  actionsFor,
  categoryLabel,
  checkReason,
  describeStatus,
  formatDate,
  isConflict,
  isSessionEnded,
  officerErrorMessage,
} from "@asaase-ani/shared";
import type { ActionInfo, OfficerApi, OfficerReportView } from "@asaase-ani/shared";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthPhoto } from "../components/AuthPhoto";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { colors, minTouch } from "../theme";

interface Props {
  api: OfficerApi;
  token: string;
  code: string;
  onBack(): void;
  onSessionEnded(): void;
}

const DONE: Record<string, string> = {
  "start-review": "Review started.",
  verify: "Report confirmed.",
  reject: "Report marked as not confirmed.",
  "request-information": "Marked as needing more information.",
  "refer-for-action": "Report passed on for action.",
  close: "Report closed.",
};

// Opens the phone's own map app at the reported position
function openMap(lat: number, lon: number) {
  const url =
    Platform.OS === "android"
      ? `geo:${lat},${lon}?q=${lat},${lon}(Reported site)`
      : Platform.OS === "ios"
        ? `https://maps.apple.com/?q=Reported%20site&ll=${lat},${lon}`
        : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  void Linking.openURL(url);
}

export function ReportDetailScreen({ api, token, code, onBack, onSessionEnded }: Props) {
  const [report, setReport] = useState<OfficerReportView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ActionInfo | null>(null);
  const [text, setText] = useState("");
  const [textProblem, setTextProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setReport(await api.getReport(token, code));
    } catch (failure) {
      if (isSessionEnded(failure)) onSessionEnded();
      else setLoadError(officerErrorMessage(failure));
    }
  }, [api, token, code, onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: ActionInfo, note?: string) {
    setBusy(true);
    setActionError(null);
    setDone(null);
    try {
      await api.review(token, code, action.action, note);
      setChosen(null);
      setText("");
      setDone(DONE[action.action] ?? "Saved.");
      await load();
    } catch (failure) {
      if (isSessionEnded(failure)) {
        onSessionEnded();
        return;
      }
      setActionError(officerErrorMessage(failure));
      if (isConflict(failure)) {
        setChosen(null);
        await load(); // show what the other officer changed
      }
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!chosen) return;
    const problem = chosen.text?.optional ? null : checkReason(text);
    setTextProblem(problem);
    if (!problem) void act(chosen, text.trim() === "" ? undefined : text.trim());
  }

  if (!report) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <>
            <Text style={styles.error} accessibilityRole="alert">
              {loadError}
            </Text>
            <Button label="Try again" tone="secondary" onPress={() => void load()} />
            <Button label="Back to all reports" tone="secondary" onPress={onBack} />
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.brand} accessibilityLabel="Loading report" />
        )}
      </View>
    );
  }

  const actions = actionsFor(report.status);
  const lat = report.latitude;
  const lon = report.longitude;
  const contact = report.contact;
  const hasContact = Boolean(contact && (contact.name || contact.phone || contact.email));
  const history = [...report.history].reverse(); // newest first

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← All reports</Text>
        </Pressable>

        <View style={styles.head}>
          <Text style={styles.code} accessibilityRole="header">
            {report.reference}
          </Text>
          <StatusBadge status={report.status} />
        </View>

        {/* Decision first: on a phone the officer should not have to scroll to act */}
        <Card title="Decision">
          {done ? (
            <Text style={styles.success} accessibilityLiveRegion="polite">
              {done}
            </Text>
          ) : null}
          {actionError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {actionError}
            </Text>
          ) : null}
          {actions.length === 0 ? (
            <Text style={styles.muted}>
              Nothing more to do here. This report is {describeStatus(report.status).label.toLowerCase()}.
            </Text>
          ) : chosen ? (
            <View>
              <Text style={styles.label}>{chosen.text?.label}</Text>
              <Text style={styles.hint}>{chosen.text?.hint}</Text>
              <TextInput
                accessibilityLabel={chosen.text?.label}
                style={[styles.textArea, textProblem ? styles.invalid : null]}
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  setTextProblem(null);
                }}
                multiline
                maxLength={1000}
                textAlignVertical="top"
                autoFocus
              />
              {textProblem ? <Text style={styles.problem}>{textProblem}</Text> : null}
              <View style={styles.buttons}>
                <Button label={busy ? "Saving…" : chosen.label} tone={chosen.tone} busy={busy} onPress={confirm} />
                <Button
                  label="Cancel"
                  tone="secondary"
                  disabled={busy}
                  onPress={() => {
                    setChosen(null);
                    setTextProblem(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              {actions.map((action) => (
                <Button
                  key={action.action}
                  label={action.label}
                  tone={action.tone}
                  busy={busy && !action.text}
                  disabled={busy}
                  onPress={() => {
                    setDone(null);
                    setActionError(null);
                    if (action.text) setChosen(action);
                    else void act(action);
                  }}
                />
              ))}
            </View>
          )}
        </Card>

        <Card title="What was reported">
          <Text style={styles.tag}>{categoryLabel(report.category)}</Text>
          <Text style={styles.body}>{report.description}</Text>
          <View style={styles.facts}>
            <Fact label="Seen" value={formatDate(report.observedAt)} />
            <Fact label="Sent" value={formatDate(report.submittedAt)} />
          </View>
        </Card>

        <Card title="Where">
          <Text style={styles.strong}>{report.area}</Text>
          {report.placeDetails ? <Text style={styles.body}>{report.placeDetails}</Text> : null}
          {lat !== null && lon !== null ? (
            <>
              <Text style={styles.body}>
                Position from the reporter's phone: {lat.toFixed(5)}, {lon.toFixed(5)}
              </Text>
              <Button label="Open in map" tone="secondary" onPress={() => openMap(lat, lon)} style={styles.mapButton} />
            </>
          ) : (
            <Text style={styles.muted}>The reporter did not share an exact position.</Text>
          )}
        </Card>

        <Card title={`Photos (${report.photoKeys.length})`}>
          {report.photoKeys.length === 0 ? (
            <Text style={styles.muted}>No photos were sent.</Text>
          ) : (
            <View style={styles.photos}>
              {report.photoKeys.map((key, index) => (
                <AuthPhoto key={key} api={api} token={token} code={report.reference} photoKey={key} label={`Photo ${index + 1}`} />
              ))}
            </View>
          )}
        </Card>

        <Card title="Reporter">
          {hasContact && contact ? (
            <View style={styles.facts}>
              {contact.name ? <Fact label="Name" value={contact.name} /> : null}
              {contact.phone ? <Fact label="Phone" value={contact.phone} /> : null}
              {contact.email ? <Fact label="Email" value={contact.email} /> : null}
            </View>
          ) : (
            <Text style={styles.muted}>The reporter chose to stay anonymous.</Text>
          )}
        </Card>

        <Card title="History">
          {history.map((event, index) => (
            <View key={`${event.to}-${event.at}`} style={styles.event}>
              <View style={[styles.dot, index === 0 && styles.dotNow]} />
              <View style={styles.flex}>
                <Text style={[styles.eventLabel, index === 0 && styles.eventLabelNow]}>{describeStatus(event.to).label}</Text>
                <Text style={styles.muted}>
                  {formatDate(event.at)} · officer {event.officerId}
                </Text>
                {event.reason ? <Text style={styles.reason}>“{event.reason}”</Text> : null}
              </View>
            </View>
          ))}
          <View style={styles.event}>
            <View style={[styles.dot, history.length === 0 && styles.dotNow]} />
            <View style={styles.flex}>
              <Text style={styles.eventLabel}>Received</Text>
              <Text style={styles.muted}>{formatDate(report.submittedAt)}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  page: { padding: 16, paddingBottom: 40 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  backText: { color: colors.brand, fontSize: 16, textDecorationLine: "underline" },
  head: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  code: { fontFamily: "monospace", fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: 0.5 },
  success: {
    color: colors.brandDark,
    backgroundColor: colors.brandTint,
    fontWeight: "700",
    fontSize: 16,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  error: { color: colors.danger, fontWeight: "600", fontSize: 16, marginBottom: 10 },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 15, marginBottom: 8 },
  label: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  textArea: {
    minHeight: 110,
    borderWidth: 2,
    borderColor: colors.fieldLine,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  invalid: { borderColor: colors.danger, backgroundColor: "#fff8f7" },
  problem: { color: colors.danger, fontWeight: "600", marginTop: 6 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  stack: { gap: 10 },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTint,
    color: colors.brandDark,
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  body: { fontSize: 16, color: colors.ink, lineHeight: 23, marginBottom: 8 },
  strong: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  mapButton: { alignSelf: "flex-start", marginTop: 4, minHeight: minTouch },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  fact: { minWidth: 130 },
  factLabel: { color: colors.muted, fontSize: 14 },
  factValue: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  photos: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  event: { flexDirection: "row", gap: 12, paddingBottom: 14 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.fieldLine,
    backgroundColor: colors.card,
    marginTop: 3,
  },
  dotNow: { backgroundColor: colors.brand, borderColor: colors.brand },
  eventLabel: { fontSize: 16, fontWeight: "600", color: colors.ink },
  eventLabelNow: { fontWeight: "800" },
  reason: { fontStyle: "italic", color: colors.ink, marginTop: 2, fontSize: 15 },
});
