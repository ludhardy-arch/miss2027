import React, { useContext, useEffect, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import ChatBubble from "../components/ChatBubble";
import SelectionBubble from "../components/SelectionBubble";
import { CANDIDATES } from "../data/candidates";

export default function Waiting({ user }) {
  const { tour, players, votesOpen } = useContext(AppContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const player = players[user.pseudo];
    if (!player) return;
    const voted = Array.isArray(player[`tour${tour}`]) && player[`tour${tour}`].length > 0;
    if (!voted) navigate("/player");
  }, [tour, players, navigate, user?.pseudo]);

  const key = `tour${tour}`;
  const { ranking, validatedVotes } = useMemo(() => {
    const counts = new Map();
    let validated = 0;
    Object.values(players).forEach(player => {
      const vote = player?.[key];
      if (!Array.isArray(vote) || vote.length === 0) return;
      validated++;
      vote.forEach((rawId, index) => {
        const id = Number(rawId);
        if (!CANDIDATES.some(candidate => candidate.id === id)) return;
        // Finale: the order represents positions 1 to 5, so score 5 to 1.
        const points = tour === 3 ? Math.max(1, 5 - index) : 1;
        counts.set(id, (counts.get(id) || 0) + points);
      });
    });
    const ranking = CANDIDATES
      .filter(candidate => counts.has(candidate.id))
      .map(candidate => ({ ...candidate, votes: counts.get(candidate.id) }))
      .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label, "fr"));
    return { ranking, validatedVotes: validated };
  }, [players, key, tour]);

  const max = ranking[0]?.votes || 1;
  const totalPlayers = Object.keys(players).length;
  const selection = Array.isArray(players[user?.pseudo]?.[key]) ? players[user.pseudo][key] : [];

  return (
    <main style={{ padding: "16px 12px 100px", maxWidth: 580, margin: "0 auto", boxSizing: "border-box" }}>
      <div role="status" aria-live="polite" style={{
        background: votesOpen ? "#176b43" : "#8e303f", color: "white",
        borderRadius: 12, padding: 13, fontWeight: 700, textAlign: "center", marginBottom: 16
      }}>
        {votesOpen ? "✅ LES VOTES SONT OUVERTS !" : "⛔ LES VOTES SONT FERMÉS"}
      </div>

      <section style={{
        borderRadius: 18, padding: "18px 14px", background: "#111827",
        color: "#f9fafb", boxShadow: "0 8px 26px rgba(0,0,0,.18)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "#f4a5cb", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>MISS FRANCE 2027</span>
          <span style={{ background: "#1b4734", color: "#a7f3c9", borderRadius: 30, padding: "5px 9px", fontSize: 11, fontWeight: 800 }}>
            ● EN DIRECT
          </span>
        </div>
        <h1 style={{ fontSize: "clamp(21px, 5vw, 27px)", lineHeight: 1.2, margin: "12px 0 5px", color: "white" }}>
          Le choix des joueurs
        </h1>
        <p style={{ fontSize: 14, color: "#ccd5e4", margin: "0 0 18px" }}>
          Tour {tour} — {tour === 1 ? "Sélection des 12 Miss" : tour === 2 ? "Sélection des 5 Miss" : "Classement des 5 finalistes"}
        </p>
        <div style={{ padding: 12, background: "#202b3d", borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13 }}>Votes validés : <strong>{validatedVotes}{totalPlayers ? ` / ${totalPlayers}` : ""}</strong></span>
          <span style={{ fontSize: 13 }}>{ranking.length} Miss classées</span>
        </div>

        {ranking.length === 0 ? (
          <p style={{ color: "#cbd5e1", textAlign: "center", padding: "24px 0" }}>
            Aucun vote validé pour ce tour pour le moment.
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {ranking.map((miss) => {
              return (
                <li key={miss.id} style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, transition: "all .35s ease" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <strong style={{ fontSize: 14, overflowWrap: "anywhere", textTransform: "capitalize" }}>
                        Miss {miss.label.trim()}
                      </strong>
                      <span style={{ fontSize: 12, whiteSpace: "nowrap", color: "#dce5f0" }}>
                        {miss.votes} {tour === 3 ? "pts" : miss.votes > 1 ? "votes" : "vote"}
                      </span>
                    </div>
                    <div style={{ background: "#394557", height: 8, borderRadius: 99, marginTop: 7, overflow: "hidden" }}>
                      <div style={{
                        width: `${(miss.votes / max) * 100}%`, height: "100%", borderRadius: 99,
                        background: "#ee97c4", transition: "width .5s ease"
                      }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p style={{ margin: "21px 0 0", textAlign: "center", color: "#9bacc3", fontSize: 12 }}>
          Actualisation automatique après chaque vote validé
          {tour === 3 ? " · 5 points pour la 1ère, jusqu’à 1 point pour la 5e" : ""}
        </p>
      </section>
      <ChatBubble user={user} />
      <SelectionBubble user={user} tour={tour} selection={selection} />
    </main>
  );
}
