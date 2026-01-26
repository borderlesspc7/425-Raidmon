import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBNE_E0Oet7h2UflCJgtXWFW-r-t-1xjog",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "raidmon-28410.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "raidmon-28410",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "raidmon-28410.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "208164290023",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:208164290023:web:f9b31bc16d7f2e82ddd142",
} as const;

const app = initializeApp(firebaseConfig);

// Nota: O aviso sobre AsyncStorage é apenas informativo
// Para React Native, a persistência é gerenciada automaticamente pelo Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { app };
export default firebaseConfig;