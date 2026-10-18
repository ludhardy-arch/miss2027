import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
