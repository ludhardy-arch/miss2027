import React, { useState, useContext } from "react";
import { AppContext } from "../context/AppContext";

export default function Tour2() {
  const { adminSelections } = useContext(AppContext);
  const [selection, setSelection] = useState([]);

  const toggleMiss = (id) => {
    if(selection.includes(id)) {
      setSelection(selection.filter(i => i !== id));
    } else {
      if(selection.length < 5) setSelection([...selection, id]);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Tour 2 - Sélectionnez 5 finalistes</h1>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {[...Array(15)].map((_, i) => {
          let color = selection.includes(i+1) ? "blue" : "gray";
          if(adminSelections.includes(i+1)) color = "green"; // bonne sélection tour1
          // jaune pour celles qui étaient neutres mais validées par admin
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
