import React from "react";
import { database } from "../firebase";
import { ref, set } from "firebase/database";

export default function TestInit() {
  
  const initDB = () => {
    set(ref(database, "rooms/miss2026"), {
      players: {},
      adminSelections: { tour1: [], tour2: [], tour3: [] },
      votesOpen: false,
      tour: 1
    })
    .then(() => {
      alert("ROOM miss2026 initialisée !");
    })
    .catch(err => {
      console.error("Erreur Firebase :", err);
      alert("Erreur, voir console.");
    });
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Initialisation Database</h1>
      <p>Clique pour créer la structure complète dans Firebase.</p>

      <button
        onClick={initDB}
        style={{
          padding: 20,
          fontSize: 20,
          background: "green",
          color: "white",
          borderRadius: 10,
          cursor: "pointer"
        }}
      >
        INITIALISER LA DB
      </button>
    </div>
  );
}
