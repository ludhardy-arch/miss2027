// src/components/SelectionBubble.jsx

import React, { useState, useEffect } from "react";
import { CANDIDATES } from "../data/candidates";

export default function SelectionBubble({ user, tour, selection }) {
  const [open, setOpen] = useState(false);

  // Filtrer les miss sélectionnées avec leurs noms
  const selectedMisses =
    selection
      ?.map((id) => CANDIDATES.find((c) => c.id === id))
      ?.filter(Boolean) || [];

  // Si tour 3 → cacher la bulle
  if (tour === 3) return null;

  return (
    <>
      {/* ⭐ BOUTON FLOTTANT BLEU A GAUCHE */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: "#4ca1ff", // bleu sélection
          boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          cursor: "pointer",
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 26,
          fontWeight: "bold",
        }}
      >
        ⭐
      </div>

      {/* ⭐ PANNEAU FENÊTRE SELON OPTION A */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: 20,
            width: 240,
            maxHeight: "60vh",
            overflowY: "auto",
            background: "rgba(0,0,0,0.85)",
            color: "white",
            padding: 15,
            borderRadius: 12,
            backdropFilter: "blur(4px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            zIndex: 9999,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 10, color: "#4ca1ff" }}>
            Sélection tour {tour}
          </h3>

          {selectedMisses.length === 0 ? (
            <p>Aucune miss sélectionnée.</p>
          ) : (
            <ul style={{ paddingLeft: 15 }}>
              {selectedMisses.map((m, i) => (
                <li
                  key={m.id}
                  style={{
                    marginBottom: 6,
                    fontSize: 16,
                  }}
                >
                  <b>{i + 1}.</b> {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
