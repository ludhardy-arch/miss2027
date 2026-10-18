import React, { useState, useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";

export default function Tour1() {
  const { adminSelections } = useContext(AppContext);
  const [selection, setSelection] = useState([]);

  const toggleMiss = (id) => {
    if(selection.includes(id)) {
      setSelection(selection.filter(i => i !== id));
    } else {
      if(selection.length < 15) setSelection([...selection, id]);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Tour 1 - Sélectionnez 15 miss</h1>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {[...Array(30)].map((_, i) => {
          let color = selection.includes(i+1) ? "blue" : "gray";
          if(adminSelections.includes(i+1)) color = "green"; // bonne sélection admin
          return (
            <div
              key={i}
              onClick={() => toggleMiss(i+1)}
              style={{
                width: 100,
                height: 100,
                margin: 5,
                border: `3px solid ${color}`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              Miss {i+1}
            </div>
          )
        })}
      </div>
      <button onClick={() => alert("Vote validé ! Page d'attente...")}>
        Valider mon vote
      </button>
    </div>
  );
}
