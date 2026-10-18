// src/pages/Admin.jsx

import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import Leaderboard from "../components/Leaderboard";
import FinaleOverlay from "../components/FinaleOverlay";
import ChatBubble from "../components/ChatBubble";
import { CANDIDATES } from "../data/candidates";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const votePulseKeyframes = `
@keyframes votePulse {
  0% { transform: scale(1); box-shadow: 0 0 10px rgba(0,255,120,0.6); }
  50% { transform: scale(1.03); box-shadow: 0 0 20px rgba(0,255,180,0.9); }
  100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,255,120,0.6); }
}
`;

export default function Admin({ user, setUser }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
      sessionStorage.removeItem("miss_user");
      setUser(null);
      navigate("/login", { replace: true });
    } catch (error) {
      alert("Déconnexion impossible : " + (error?.message || "erreur inconnue"));
      setLoggingOut(false);
    }
  };
  const reportActionError = (error) => {
    console.error("Firebase admin action refused:", error);
    alert("Action impossible : " + (error?.code || error?.message || "erreur inconnue") + ". Vérifie ta connexion Google et les règles Firebase.");
  };
  const safely = async (task) => { try { await task(); } catch (err) { reportActionError(err); } };
  const {
    votesOpen,
    connectionsOpen,
    updateConnectionsOpen,
    updateVotesOpen,
    tour,
    updateTour,
    adminSelections,
    updateAdminSelections,
    resetGame,
    players,
    finaleStarted,
    updateFinaleStarted,
  } = useContext(AppContext);

  const [selection, setSelection] = useState([]);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [ranking, setRanking] = useState({});

  useEffect(() => {
    const current = adminSelections[`tour${tour}`];

    if (tour === 3 && Array.isArray(current) && current.length === 5) {
      const obj = {};
      current.forEach((missId, index) => (obj[missId] = index + 1));
      setRanking(obj);
      setSelection([]);
    } else {
      setSelection(current || []);
      setRanking({});
    }
  }, [tour, adminSelections]);

  const candidateIds =
    tour === 1
      ? CANDIDATES.map((m) => m.id)
      : tour === 2
      ? adminSelections.tour1 || []
      : adminSelections.tour2 || [];

  const candidates = candidateIds
    .map((id) => CANDIDATES.find((m) => m.id === id))
    .filter(Boolean);

  // ⭐ Tour 1 : 12 miss
  const maxSelect = tour === 1 ? 12 : 5;

  const handleClickMiss = (id) => {
    if (tour === 3) return;

    if (selection.includes(id)) {
      setSelection(selection.filter((x) => x !== id));
    } else if (selection.length < maxSelect) {
      setSelection([...selection, id]);
    }
  };

  const getRankLabel = (rank) => {
    if (rank === 1) return "Miss France";
    if (rank === 2) return "1ère dauphine";
    if (rank === 3) return "2ème dauphine";
    if (rank === 4) return "3ème dauphine";
    return "4ème dauphine";
  };

  const handleValidate = () => {
    if (tour < 3) {
      if (selection.length !== maxSelect)
        return alert(`Vous devez sélectionner ${maxSelect} miss.`);

      if (!window.confirm(`Valider le tour ${tour} ?`)) return;

      safely(async () => { await updateAdminSelections(tour, selection); await updateTour(tour + 1); });
      return;
    }

    // Tour 3
    const ranks = Object.values(ranking).filter(Boolean);
    if (ranks.length !== 5)
      return alert("Classez les 5 miss de la 1ère à la 5ème place.");

    const needed = [1, 2, 3, 4, 5];
    if (!needed.every((r) => ranks.includes(r)))
      return alert("Chaque place doit être unique.");

    if (!window.confirm("Confirmer le classement final ?")) return;

    const ordered = [];
    for (let r = 1; r <= 5; r++) {
      const entry = Object.entries(ranking).find(([, rank]) => rank === r);
      if (entry) ordered.push(Number(entry[0]));
    }

    safely(() => updateAdminSelections(3, ordered));
  };

  const playerHasVoted = (p) => {
    if (!p) return false;
    const t = p[`tour${tour}`];
    return t && (Array.isArray(t) ? t.length > 0 : Object.keys(t).length > 0);
  };

  const getBorderClass = (id) =>
    selection.includes(id) ? "border-blue" : "border-grey";

  const usedRanks = Object.values(ranking).filter(Boolean);

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <style>{votePulseKeyframes}</style>

      {finaleStarted && (
        <FinaleOverlay
          players={players}
          adminSelections={adminSelections}
          isAdmin={true}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: "12px 0" }}>ADMIN — {user.pseudo}</h1>
        <button onClick={handleLogout} disabled={loggingOut} style={{ padding: "9px 14px", borderRadius: 9, background: "#32323c", color: "white", border: "1px solid #777", cursor: "pointer" }}>
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>

      {votesOpen && (
        <div
          style={{
            margin: "0 auto 15px",
            maxWidth: 500,
            padding: "10px 18px",
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(0,200,120,0.95), rgba(0,255,180,0.95))",
            textAlign: "center",
            fontWeight: "bold",
            animation: "votePulse 1.6s infinite",
          }}
        >
          ✅ VOTES OUVERTS !!!
        </div>
      )}

      {/* Contrôles */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button onClick={() => safely(() => updateConnectionsOpen(!connectionsOpen))} style={{ background: connectionsOpen ? "#933d42" : "#17794d", color: "white", padding: "10px 16px" }}>
          {connectionsOpen ? "🔒 Fermer les connexions" : "🔓 Ouvrir les connexions"}
        </button>
        <button onClick={() => safely(() => updateVotesOpen(!votesOpen))}>
          {votesOpen ? "Fermer les votes" : "Ouvrir les votes"}
        </button>


        {tour === 3 && (
          <button
            onClick={() => safely(() => updateFinaleStarted(true))}
            style={{
              background: "linear-gradient(135deg, #ffd700, #ff00aa)",
              color: "white",
            }}
          >
            🎉 Lancer le show final
          </button>
        )}
      </div>

      <details style={{ margin: "28px auto 16px", maxWidth: 500, padding: 12, border: "1px solid #754343", borderRadius: 10 }} open={showDangerZone} onToggle={event => setShowDangerZone(event.currentTarget.open)}>
        <summary style={{ cursor: "pointer", color: "#e6a2a2", fontWeight: "bold" }}>⚠️ Zone sensible — Réinitialiser la partie</summary>
        <p style={{ fontSize: 14 }}>Cette action efface tous les joueurs, votes et résultats du jeu. Elle est irréversible.</p>
        <label htmlFor="reset-confirm">Écris <strong>RESET</strong> pour confirmer :</label>
        <input id="reset-confirm" value={resetConfirmation} onChange={event => setResetConfirmation(event.target.value)} autoComplete="off" style={{ display: "block", width: "100%", margin: "10px 0", padding: 10, boxSizing: "border-box" }} />
        <button disabled={resetConfirmation !== "RESET"} onClick={() => {
          if (!window.confirm("Dernière confirmation : effacer définitivement toute la partie ?")) return;
          safely(async () => { await resetGame(); setResetConfirmation(""); setShowDangerZone(false); });
        }} style={{ background: "#8b1e2b", color: "white", padding: 10 }}>
          Supprimer la partie et recommencer
        </button>
      </details>

      {/* Joueurs */}
      <div
        style={{
          margin: "20px auto",
          maxWidth: 500,
          padding: 15,
          borderRadius: 12,
          background: "rgba(0,0,0,0.45)",
        }}
      >
        <h2>Joueurs</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.keys(players).map((pseudo) => {
            const p = players[pseudo];
            const voted = playerHasVoted(p);

            return (
              <li
                key={pseudo}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  fontSize: 18,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {pseudo}
                <span
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: voted ? "limegreen" : "gold",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                ></span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Sélection tour 1 & 2 */}
      {tour !== 3 && (
        <>
          <h2>Tour {tour} — sélectionnez {maxSelect} miss</h2>

          <div className="grid">
            {candidates.map((miss) => (
              <div
                key={miss.id}
                className={`miss-card ${getBorderClass(miss.id)}`}
                onClick={() => handleClickMiss(miss.id)}
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  borderWidth: 5,
                }}
              >
                <img
                  src={miss.image}
                  alt={miss.label}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                />
                <div>{miss.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tour 3 */}
      {tour === 3 && (
        <>
          <h2>Classement final</h2>

          <div className="grid">
            {candidates.map((miss) => (
              <div
                key={miss.id}
                className="miss-card border-grey"
                style={{
                  textAlign: "center",
                  borderWidth: 5,
                }}
              >
                <img
                  src={miss.image}
                  alt={miss.label}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                />
                <div style={{ fontSize: 18, marginBottom: 8 }}>
                  {miss.label}
                </div>

                <select
                  value={ranking[miss.id] || ""}
                  onChange={(e) => {
                    const newRank = Number(e.target.value);
                    setRanking((prev) => {
                      const updated = { ...prev };
                      delete updated[miss.id];

                      Object.keys(updated).forEach((mid) => {
                        if (updated[mid] === newRank) delete updated[mid];
                      });

                      updated[miss.id] = newRank;
                      return updated;
                    });
                  }}
                  style={{ width: "100%", padding: 8, borderRadius: 8 }}
                >
                  <option value="">— Choisir —</option>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {getRankLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Validation */}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleValidate}>
          Valider {tour === 3 ? "le classement" : "la sélection"}
        </button>
      </div>

      <Leaderboard />

      <ChatBubble user={user} />
    </div>
  );
}
