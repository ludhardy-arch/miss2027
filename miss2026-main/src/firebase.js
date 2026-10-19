import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { initializeAuth, connectAuthEmulator, browserSessionPersistence, browserPopupRedirectResolver } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD14OqrBD-hEGyNQNOoSar_xTiwpWzlr8Y",
  authDomain: "miss2027.firebaseapp.com",
  databaseURL: "https://miss2027-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "miss2027",
  storageBucket: "miss2027.firebasestorage.app",
  messagingSenderId: "1094478454572",
  appId: "1:1094478454572:web:eeb7973e0adb4648859689"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
// Independent Firebase session in each browser tab. It survives a refresh,
// but is not shared as a permanent login between tabs.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});


/* Local-only load test. Disabled in Render production and TEST builds. */
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(database, "127.0.0.1", 9000);
}
