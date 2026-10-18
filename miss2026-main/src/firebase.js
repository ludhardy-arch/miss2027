import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAkIsA91xp05WvOmaQoAfN2-tvmBwjFzfc",
  authDomain: "miss2026-50e81.firebaseapp.com",
  databaseURL: "https://miss2026-50e81-default-rtdb.europe-west1.firebasedatabase.app",  // AJOUTE ÇA !
  projectId: "miss2026-50e81",
  storageBucket: "miss2026-50e81.firebasestorage.app",
  messagingSenderId: "998658774500",
  appId: "1:998658774500:web:19761bbf576ecfdccbe3f1",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
