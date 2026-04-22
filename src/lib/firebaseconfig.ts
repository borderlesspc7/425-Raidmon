import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

function requireExpoPublicEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Firebase: variável ${name} ausente. Copie .env.example para .env, preencha e reinicie o Expo (npm start).`
    );
  }
  return value;
}

const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

const firebaseConfig = {
  apiKey: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireExpoPublicEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
  ...(measurementId ? { measurementId } : {}),
} as const;

const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const functionsRegion =
  process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || "southamerica-east1";

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
