// src/components/FinalShow.jsx
import React, { useState, useEffect, useContext } from "react";
import confetti from "canvas-confetti";
import { calculatePoints } from "../services/points";
import { AppContext } from "../context/AppContext";

export default function FinalShow({ players, adminSelections, isAdmin }) {
  const { updateFinaleStarted } = useContext(AppContext) || {};

  const [phase, setPhase] = useState("intro");
  const [introStep, setIntroStep] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [step, setStep] = useState(0);
  const [showNameDelay, setShowNameDelay] = useState(false);
  const [winnerPhase, setWinnerPhase] = useState(0);

  const ranking = React.useMemo(() => {
    return Object.entries(players || {})
      .map(([pseudo, votes]) => ({
        pseudo,
        points: calculatePoints(votes, adminSelections),
      }))
      .sort((a, b) => b.points - a.points)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [players, adminSelections]);

  const winner = ranking[0];

  const currentPlayer =
    step < ranking.length - 1 ? ranking[ranking.length - 1 - step] : null;

  // INTRO
  useEffect(() => {
    if (phase !== "intro") return;

    if (introStep === 0) {
      const t = setTimeout(() => setIntroStep(1), 4000);
      return () => clearTimeout(t);
    }
    if (introStep === 1) {
      const t = setTimeout(() => setIntroStep(2), 4000);
      return () => clearTimeout(t);
    }
    if (introStep === 2 && countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (introStep === 2 && countdown === 0) {
      setTimeout(() => setPhase("reveal"), 2000);
    }
  }, [phase, introStep, countdown]);

  // REVEAL jusqu'à la 2e place
  useEffect(() => {
    if (phase !== "reveal") return;
    if (step >= ranking.length - 1) return;

    setShowNameDelay(false);

    const delay = setTimeout(() => setShowNameDelay(true), 2500);
    const next = setTimeout(() => setStep((s) => s + 1), 5500);

    return () => {
      clearTimeout(delay);
      clearTimeout(next);
    };
  }, [phase, step, ranking.length]);

  // FINALE EPIC
  useEffect(() => {
    if (phase !== "reveal") return;
    if (step !== ranking.length - 1) return;

    setTimeout(() => setWinnerPhase(1), 2000);
  }, [phase, step, ranking.length]);

  useEffect(() => {
    if (winnerPhase === 1) {
      setTimeout(() => setWinnerPhase(2), 2500);
    }
    if (winnerPhase === 2) {
      setTimeout(() => setWinnerPhase(3), 2500);
    }
    if (winnerPhase === 3) {
      confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });
      setTimeout(() => {
        confetti({ particleCount: 200, spread: 140, origin: { y: 0.6 } });
      }, 400);
    }
  }, [winnerPhase]);

  const quit = () =>
    confirm("Quitter le show ?") && updateFinaleStarted?.(false);

  return (
    <>
      {/* BACKGROUND */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(135deg, #0f0f3d 0%, #000428 50%, #000814 100%)",
          zIndex: 9998,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(circle at 20% 20%, rgba(100,150,255,0.4), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255,215,0,0.4), transparent 50%)
          `,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Bebas Neue', Arial, sans-serif",
          color: "white",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "15px 20px",
            background: "rgba(0,0,0,0.7)",
            fontSize: "1.8rem",
            letterSpacing: "4px",
            textShadow: "0 0 20px #ffd700",
            position: "relative",
          }}
        >
          MISS PRONO 2026
          {isAdmin && (
            <button
              onClick={quit}
              style={{
                position: "absolute",
                right: 15,
                top: 15,
                padding: "8px 16px",
                background: "#c00",
                border: "none",
                borderRadius: 20,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Quitter
            </button>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          {/* INTRO */}
          {phase === "intro" && (
            <div>
              {introStep >= 0 && (
                <div style={{ fontSize: "3.2rem", marginBottom: "2rem" }}>
                  Miss France<br />
                  est élue…
                </div>
              )}
              {introStep >= 1 && (
                <div
                  style={{ fontSize: "2.8rem", margin: "2rem 0", color: "#ffd700" }}
                >
                  Mais pour nous<br />
                  QUI AURA LA COURONNE ?
                </div>
              )}
              {introStep >= 2 && (
                <div
                  style={{
                    fontSize: countdown > 0 ? "12rem" : "5rem",
                    fontWeight: 900,
                    marginTop: "3rem",
                    textShadow: "0 0 40px #ffd700",
                  }}
                >
                  {countdown > 0 ? countdown : "RESULTATS OFFICIELS !"}
                </div>
              )}
            </div>
          )}

          {/* RÉVÉLATIONS — DU DERNIER À LA 2E PLACE */}
          {phase === "reveal" && currentPlayer && step < ranking.length - 1 && (
            <div>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                À la {currentPlayer.rank}ème place :
              </div>
              {showNameDelay && (
                <div
                  style={{
                    fontSize: "5.5rem",
                    fontWeight: 900,
                    textShadow: "0 0 50px #ffd700",
                  }}
                >
                  {currentPlayer.pseudo}
                </div>
              )}
            </div>
          )}

          {/* 🎉 FINALE — MISS PRONO 2026 🎉 */}
          {phase === "reveal" && step === ranking.length - 1 && winner && (
            <div>
              {winnerPhase >= 1 && (
                <div
                  style={{
                    fontSize: "5rem",
                    marginBottom: "1rem",
                    color: "#ffd700",
                  }}
                >
                  MISS PRONO 2026
                </div>
              )}

              {winnerPhase >= 2 && (
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                  est ET restera...
                </div>
              )}

              {winnerPhase >= 3 && (
                <div
                  style={{
                    fontSize: "7rem",
                    fontWeight: 900,
                    textShadow:
                      "0 0 80px #ffd700, 0 0 140px #ff4500",
                  }}
                >
                  {winner.pseudo}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CLASSEMENT FINAL — APPARAÎT APRÈS LE GAGNANT */}
        {winnerPhase === 3 && (
          <div
            style={{
              background: "rgba(0,0,0,0.8)",
              padding: "20px",
              borderRadius: "20px 20px 0 0",
              fontSize: "1.5rem",
              overflowY: "auto",
              maxHeight: "50vh",
            }}
          >
            <h3 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
              Classement Final
            </h3>

            {ranking.map((p) => (
              <div
                key={p.pseudo}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #333",
                  fontWeight: p.rank === 1 ? "bold" : "normal",
                  color: p.rank === 1 ? "#ffd700" : "white",
                }}
              >
                {p.rank === 1 ? "1er" : `${p.rank}ème`} → {p.pseudo} ({p.points} pts)
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes zoomIn {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          70% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
