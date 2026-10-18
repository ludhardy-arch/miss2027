// src/pages/Results.jsx

import React, { useContext, useMemo, useEffect, useState } from "react";
import { AppContext } from "../context/AppContext";
import { calculatePoints } from "../services/points";

export default function Results() {
  const { players, adminSelections } = useContext(AppContext);

  // 🔢 Calcul du classement des joueurs (même logique que Leaderboard)
  const ranking = useMemo(() => {
    return Object.entries(players)
      .map(([pseudo, votes]) => ({
        pseudo,
        points: calculatePoints(votes, adminSelections),
      }))
      .sort((a, b) => b.points - a.points);
  }, [players, adminSelections]);

  const reversed = [...ranking].reverse(); // du dernier au premier

  const [count, setCount] = useState(5);
  const [stage, setStage] = useState("countdown"); // "countdown" | "reveal" | "done"
  const [visibleCount, setVisibleCount] = useState(0);

  // Compte à rebours 5 → 0
  useEffect(() => {
    if (stage !== "countdown") return;
    if (count === 0) {
      setStage("reveal");
      return;
    }

    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, stage]);

  // Révélation du classement
  useEffect(() => {
    if (stage !== "reveal") return;
    if (visibleCount >= reversed.length) {
      setStage("done");
      return;
    }

    const t = setTimeout(
      () => setVisibleCount((c) => c + 1),
      1000
    );
    return () => clearTimeout(t);
  }, [stage, visibleCount, reversed.length]);

  const winner = ranking[0];

  // Style pour le chiffre de compte à rebours
  const countdownColor = (num) => {
    switch (num) {
      case 5:
        return "#ff00aa";
      case 4:
        return "#ff8800";
      case 3:
        return "#ffd400";
      case 2:
        return "#66ff66";
      case 1:
        return "#66ccff";
      case 0:
        return "#ffffff";
      default:
        return "#ffffff";
    }
  };

  if (!winner) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h1>Pas encore de résultats…</h1>
        <p>Il faut d'abord que l'admin termine le classement.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {stage === "countdown" && (
        <div
          style={{
            marginTop: 60,
          }}
        >
          <h1 style={{ fontSize: 32, marginBottom: 20 }}>
            Attention... Résultats dans :
          </h1>
          <div
            style={{
              fontSize: 120,
              fontWeight: "bold",
              color: countdownColor(count),
              textShadow: "0 0 20px rgba(0,0,0,0.5)",
            }}
          >
            {count}
          </div>
        </div>
      )}

      {stage !== "countdown" && (
        <>
          <h1 style={{ fontSize: 32, marginBottom: 10 }}>
            Classement final des pronostics
          </h1>

          {/* Révélation du dernier au premier */}
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: 30,
              maxWidth: 500,
              marginInline: "auto",
              textAlign: "left",
            }}
          >
            {reversed.slice(0, visibleCount).map((p, index) => {
              const placeFromBottom = index + 1;
              const place = ranking.length - placeFromBottom + 1;

              return (
                <li
                  key={p.pseudo}
                  style={{
                    marginBottom: 8,
                    fontSize: 18,
                    opacity: 1,
                    transform: "translateX(0)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <b>{place}.</b> {p.pseudo} — {p.points} pts
                </li>
              );
            })}
          </ol>

          {stage === "done" && (
            <div
              style={{
                marginTop: 50,
                padding: 20,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, #ff00aa, #ff8800, #ffd400)",
                color: "white",
                boxShadow: "0 0 25px rgba(0,0,0,0.4)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Faux confettis avec emojis */}
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: 0,
                  right: 0,
                  fontSize: 32,
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              >
                🎉✨🎊🎉✨🎊🎉✨🎊
              </div>

              <h2 style={{ fontSize: 30, marginBottom: 10 }}>
                🏆 Vainqueur de Miss2026 Pronostics 🏆
              </h2>
              <div style={{ fontSize: 40, fontWeight: "bold", marginBottom: 10 }}>
                {winner.pseudo}
              </div>
              <div style={{ fontSize: 24 }}>
                avec <b>{winner.points}</b> points !
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 18,
                }}
              >
                Bravo !!! 🎉
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
