// src/pages/Waiting.jsx

import React, { useContext, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import ChatBubble from "../components/ChatBubble"; 
import SelectionBubble from "../components/SelectionBubble"; // ⭐ AJOUT ICI ⭐

export default function Waiting({ user }) {
  const { tour, players, votesOpen } = useContext(AppContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const player = players[user.pseudo];

    // Si le joueur n'existe pas encore en base → on attend sync
    if (!player) return;

    const hasVotedThisTour =
      Array.isArray(player[`tour${tour}`]) &&
      player[`tour${tour}`].length > 0;

    // SI le joueur n'a PAS voté ce tour → retour à l'écran Player
    if (!hasVotedThisTour) {
      navigate("/player");
    }
  }, [tour, players, navigate, user]);

  const totalPlayers = Object.keys(players).length;
  const validatedVotes = Object.values(players).filter((player) =>
    Array.isArray(player?.[`tour${tour}`]) && player[`tour${tour}`].length > 0
  ).length;
  const percentage = totalPlayers > 0 ? Math.round((validatedVotes / totalPlayers) * 100) : 0;

  const message =
    tour === 3
      ? "Attention !!! Qui va gagner ???"
      : "Patientez le temps que Ludo valide les votes.";

  // ⭐ Récupération de la sélection du joueur
  const playerData = players[user?.pseudo] || {};
  const selection =
    Array.isArray(playerData[`tour${tour}`])
      ? playerData[`tour${tour}`]
      : [];

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div role="status" aria-live="polite" style={{ padding: 14, marginBottom: 20, borderRadius: 12, background: votesOpen ? "#147d36" : "#a22525", color: "white", fontWeight: "bold", fontSize: 20 }}>
        {votesOpen ? "✅ LES VOTES SONT OUVERTS !" : "⛔ LES VOTES SONT FERMÉS"}
      </div>
      <h1>{message}</h1>

      {/* Pub Malounette pendant l'attente */}
      <MalounetteAd />

      {/* ⭐ CHAT BUBBLE A DROITE ⭐ */}
      <ChatBubble user={user} />

      {/* ⭐⭐ BULLE BLEUE A GAUCHE (LISTE DES MISS) ⭐⭐ */}
      <SelectionBubble 
        user={user} 
        tour={tour} 
        selection={selection} 
      />
    </div>
  );
}
