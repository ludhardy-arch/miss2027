import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { initializeAuth, browserSessionPersistence, browserPopupRedirectResolver } from "firebase/auth";

// Test branch: no production fallback. Configure a separate Firebase project in Render.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const required = ["apiKey", "authDomain", "databaseURL", "projectId", "messagingSenderId", "appId"];
if (required.some((key) => !firebaseConfig[key]?.trim())) {
  throw new Error("Firebase TEST : configuration indépendante manquante.");
}
const productionProject = "miss2027";
const productionDatabase = "miss2027-default-rtdb.europe-west1.firebasedatabase.app";
const dbURL = new URL(firebaseConfig.databaseURL);
if (
  dbURL.protocol !== "https:" ||
  firebaseConfig.projectId.trim().toLowerCase() === productionProject ||
  firebaseConfig.authDomain.trim().toLowerCase() === "miss2027.firebaseapp.com" ||
  dbURL.hostname.toLowerCase().replace(/\.$/, "") === productionDatabase ||
  firebaseConfig.messagingSenderId === "1094478454572" ||
  firebaseConfig.appId.startsWith("1:1094478454572:")
) {
  throw new Error("Firebase TEST : la configuration de production est interdite.");
}

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
// Independent Firebase session in each browser tab. It survives a refresh,
// but is not shared as a permanent login between tabs.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// French-language Firebase authentication emails and flows on the test site.
auth.languageCode = "fr";
