import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

/**
 * Leitura estática de EXPO_PUBLIC_* para o Metro/EAS embutirem os valores no bundle.
 */
function requirePublicEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Firebase: ${name} ausente ou vazio. Copie .env.example para .env, preencha as variáveis EXPO_PUBLIC_* e reinicie o Expo. Em EAS, defina-as no perfil de build.`,
    );
  }
  return trimmed;
}

const measurementIdRaw = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

const firebaseConfig = {
  apiKey: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  ),
  authDomain: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  storageBucket: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: requirePublicEnv(
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  ),
  ...(measurementIdRaw ? { measurementId: measurementIdRaw } : {}),
} as const;

const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const functionsRegion =
  process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim() ||
  "southamerica-east1";

export const functions = getFunctions(app, functionsRegion);

/** Google Analytics só no build web; em iOS/Android retorna null. */
export async function getFirebaseAnalytics() {
  if (Platform.OS !== "web") {
    return null;
  }
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    const supported = await isSupported();
    if (!supported) {
      return null;
    }
    return getAnalytics(app);
  } catch {
    return null;
  }
}

export { app };
export default firebaseConfig;
