import { Platform } from "react-native";

// Where the API lives. On a real phone "localhost" is the phone itself, so set EXPO_PUBLIC_API_URL
// to your computer's address on the same Wi-Fi, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
// The Android emulator reaches the computer at 10.0.2.2.
const fallback = Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fallback).replace(/\/$/, "");
