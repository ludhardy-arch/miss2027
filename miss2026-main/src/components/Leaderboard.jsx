// src/components/Leaderboard.jsx

import React, { useContext, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { calculatePoints } from "../services/points";

export default function Leaderboard({ showPoints = false, demoPlayers = null, demoSelections = null }) {
  const { players, adminSelections } = useContext(AppContext);

  // 🔥 recalcul automatique dès que les votes ou les sélections admin changent
  const ranking = useMemo(() => {
    return Object.entries(demoPlayers || players)
      .map(([pseudo, votes]) => ({
        pseudo,
        points: calculatePoints(votes, demoSelections || adminSelections),
      }))
      .sort((a, b) => b.points - a.points);
  }, [players, adminSelections, demoPlayers, demoSelections]);

  return (
    <section className="tv-leaderboard tv-scoreboard-v3">
      <div className="tv-kicker">✦ TABLEAU DES SCORES ✦</div><h2>LE CLASSEMENT</h2><p className="tv-lead-subtitle">Qui décrochera la couronne ?</p>
      <ol>
        {ranking.map((p, index) => (
          <li className={`tv-rank-row ${index < 3 ? "tv-top-rank" : ""}`} key={p.pseudo}><span className="tv-rank-num">{index === 0 ? "👑" : String(index + 1).padStart(2, "0")}</span><span className="tv-rank-player">
            {p.pseudo}</span>{showPoints && <b className="tv-rank-score">{p.points} pts</b>}
          </li>
        ))}
      </ol>
    </section>
  );
}
