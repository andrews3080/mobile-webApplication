import { ApiError, officerErrorMessage } from "@asaase-ani/shared";
import type { OfficerApi } from "@asaase-ani/shared";
import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { colors, minTouch, radius } from "../theme";

interface Props {
  api: OfficerApi;
  notice?: string;
  onLoggedIn(token: string): void;
}

export function LoginScreen({ api, notice, onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    if (busy) return;
    if (email.trim() === "" || password === "") {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api.login(email.trim(), password));
    } catch (failure) {
      setPassword("");
      setError(
        failure instanceof ApiError && failure.status === 401
          ? "Email or password is incorrect."
          : failure instanceof ApiError && failure.kind === "rate_limited"
            ? "Too many login attempts. Please wait 15 minutes and try again."
            : officerErrorMessage(failure),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1} accessibilityRole="header">
          Officer login
        </Text>
        <Text style={styles.lead}>For authorised officers and administrators. Reporters use the Asaase Ani website.</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Text style={[styles.label, styles.gap]}>Password</Text>
          <View style={styles.row}>
            <TextInput
              ref={passwordRef}
              accessibilityLabel="Password"
              style={[styles.input, styles.flex]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            <Button
              label={showPassword ? "Hide" : "Show"}
              tone="secondary"
              onPress={() => setShowPassword(!showPassword)}
              style={styles.show}
            />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={busy ? "Logging in…" : "Log in"} busy={busy} onPress={() => void submit()} style={styles.gap} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: 16, paddingTop: 24 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  lead: { fontSize: 16, color: colors.muted, marginBottom: 16, lineHeight: 23 },
  notice: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
    borderWidth: 2,
    borderRadius: radius,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: colors.ink,
  },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius, padding: 16 },
  label: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  gap: { marginTop: 16 },
  input: {
    minHeight: minTouch,
    borderWidth: 2,
    borderColor: colors.fieldLine,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center" },
  show: { marginLeft: 8 },
  error: { color: colors.danger, fontWeight: "600", fontSize: 16, marginTop: 12 },
});
