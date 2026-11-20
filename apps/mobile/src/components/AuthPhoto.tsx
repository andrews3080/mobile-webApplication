import { photoFileName } from "@asaase-ani/shared";
import type { OfficerApi } from "@asaase-ani/shared";
import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { API_URL } from "../config";
import { colors } from "../theme";

interface Props {
  api: OfficerApi;
  token: string;
  code: string;
  photoKey: string;
  label: string;
}

// Officer photos need the login token.
// On a phone, <Image> can send it as a header. The browser preview cannot, so there we download the photo first.
export function AuthPhoto({ api, token, code, photoKey, label }: Props) {
  const nativeUri = `${API_URL}/api/officer/reports/${encodeURIComponent(code)}/photos/${encodeURIComponent(photoFileName(photoKey))}`;
  const [webUri, setWebUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .getPhoto(token, code, photoKey)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, token, code, photoKey]);

  if (failed) {
    return (
      <View style={[styles.frame, styles.center]}>
        <Text style={styles.missing}>{label} could not be loaded</Text>
      </View>
    );
  }

  const source =
    Platform.OS === "web" ? (webUri ? { uri: webUri } : null) : { uri: nativeUri, headers: { Authorization: `Bearer ${token}` } };
  if (!source) {
    return (
      <View style={[styles.frame, styles.center]}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${label}. Open full size`}
      onPress={() => {
        if (Platform.OS === "web" && webUri) void Linking.openURL(webUri);
      }}
      style={styles.frame}
    >
      <Image source={source} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.page,
    overflow: "hidden",
    marginBottom: 10,
  },
  center: { alignItems: "center", justifyContent: "center", padding: 6 },
  image: { width: "100%", height: "100%" },
  loading: { color: colors.muted },
  missing: { color: colors.danger, textAlign: "center" },
});
