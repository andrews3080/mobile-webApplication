import { HttpOfficerApi } from "@asaase-ani/shared";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "./config";
import { LoginScreen } from "./screens/LoginScreen";
import { ReportDetailScreen } from "./screens/ReportDetailScreen";
import { ReportListScreen } from "./screens/ReportListScreen";
import { SecureTokenStore } from "./secure-token-store";
import { colors } from "./theme";

// One API client and one token store for the whole app
const api = new HttpOfficerApi(API_URL);
const tokens = new SecureTokenStore();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <OfficerApp />
    </SafeAreaProvider>
  );
}

// Login, then the list, then one report. Small enough that a navigation library is not needed yet.
function OfficerApp() {
  const [token, setToken] = useState<string | null>(() => tokens.load());
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  const endSession = useCallback((message?: string) => {
    tokens.clear();
    setToken(null);
    setOpenCode(null);
    setNotice(message);
  }, []);

  const onSessionEnded = useCallback(() => endSession("Your session has ended. Please log in again."), [endSession]);

  // Android back button: from a report go back to the list, instead of leaving the app
  useEffect(() => {
    if (Platform.OS === "web") return; // the browser preview has its own back button
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (openCode) {
        setOpenCode(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [openCode]);

  const screen = useMemo(() => {
    if (!token) {
      return (
        <LoginScreen
          api={api}
          notice={notice}
          onLoggedIn={(newToken) => {
            tokens.save(newToken);
            setNotice(undefined);
            setToken(newToken);
          }}
        />
      );
    }
    if (openCode) {
      return <ReportDetailScreen api={api} token={token} code={openCode} onBack={() => setOpenCode(null)} onSessionEnded={onSessionEnded} />;
    }
    return (
      <ReportListScreen api={api} token={token} filter={filter} onFilter={setFilter} onOpen={setOpenCode} onSessionEnded={onSessionEnded} />
    );
  }, [token, openCode, filter, notice, onSessionEnded]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.bar}>
        <Text style={styles.brand}>Asaase Ani</Text>
        <Text style={styles.role}>Officers</Text>
        {token ? (
          <Pressable accessibilityRole="button" onPress={() => endSession("You have logged out.")} style={styles.logout} hitSlop={8}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>{screen}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  brand: { color: colors.brandInk, fontSize: 19, fontWeight: "800" },
  role: {
    color: colors.brandDark,
    backgroundColor: colors.brandInk,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  logout: { marginLeft: "auto", minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  logoutText: { color: colors.brandInk, fontSize: 16, fontWeight: "600", textDecorationLine: "underline" },
  body: { flex: 1, backgroundColor: colors.page },
});
