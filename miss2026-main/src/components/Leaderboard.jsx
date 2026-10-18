// src/components/Leaderboard.jsx

import React, { useContext, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { calculatePoints } from "../services/points";

export default function Leaderboard() {
  const { players, adminSelections } = useContext(AppContext);

  // 🔥 recalcul automatique dès que les votes ou les sélections admin changent
  const ranking = useMemo(() => {
    return Object.entries(players)
      .map(([pseudo, votes]) => ({
        pseudo,
        points: calculatePoints(votes, adminSelections),
      }))
      .sort((a, b) => b.points - a.points);
  }, [players, adminSelections]);

  return (
    <div style={{ marginTop: 30 }}>
      <h2>Classement</h2>
      <ol>
        {ranking.map(p => (
          <li key={p.pseudo}>
            {p.pseudo} — <b>{p.points} pts</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
