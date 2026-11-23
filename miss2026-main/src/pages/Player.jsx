// src/pages/Player.jsx

import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

import Leaderboard from "../components/Leaderboard";
import ChatBubble from "../components/ChatBubble";
import SelectionBubble from "../components/SelectionBubble";
import { CANDIDATES } from "../data/candidates";

// Animation bannière votes ouverts
const votePulseKeyframes = `
@keyframes votePulse {
  0% { transform: scale(1); box-shadow: 0 0 10px rgba(0,255,120,0.6); }
  50% { transform: scale(1.03); box-shadow: 0 0 20px rgba(0,255,180,0.9); }
  100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,255,120,0.6); }
}
`;

export default function Player({ user, setUser }) {
  const {
    tour,
    votesOpen,
    adminSelections,
    updatePlayerVote,
    updateFirstRoundWithFavorite,
    players,
    gameId,
  } = useContext(AppContext);

  const navigate = useNavigate();

  // ⭐⭐⭐ DÉCONNEXION TOTALE ⭐⭐⭐
  const handleLogout = async () => {
    if (!window.confirm("Voulez-vous vraiment vous déconnecter ?")) return;

    // Keep anonymous Firebase identity so this browser can reclaim the pseudo.
    sessionStorage.removeItem("miss_user");
    setUser(null);
    navigate("/login", { replace: true });
  };

  // ----------------------------------------------------------------------------------------
  // LOGIQUE DU PLAYER
  // ----------------------------------------------------------------------------------------

  const [selection, setSelection] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [ranking, setRanking] = useState({});
  const [showVoteBanner, setShowVoteBanner] = useState(true);
  const [votePending, setVotePending] = useState(false);
  const [voteFeedback, setVoteFeedback] = useState("");

  // Bannière votes ouverts réapparait à chaque tour
  useEffect(() => {
    setShowVoteBanner(true);
  }, [tour]);


  const playerData = players[user.pseudo] || {};
  const currentKey = `tour${tour}`;
  const hasVotedThisTour =
    Array.isArray(playerData[currentKey]) &&
    playerData[currentKey].length > 0;

  // ⭐ Tour 1 = 12 miss
  const maxSelect = tour === 1 ? 12 : tour === 2 ? 5 : 5;

  // IDS candidates selon tour
  const candidateIds =
    tour === 1
      ? CANDIDATES.map((c) => c.id)
      : tour === 2
      ? adminSelections.tour1 || []
      : adminSelections.tour2 || [];

  const candidates = candidateIds
    .map((id) => CANDIDATES.find((c) => c.id === id))
    .filter(Boolean);

  // Si déjà voté, aller en attente
  useEffect(() => {
    if (hasVotedThisTour) navigate("/waiting");
  }, [hasVotedThisTour, navigate]);

  // Charger sélection locale
  useEffect(() => {
    if (hasVotedThisTour) return;

    const key =
      tour === 3
        ? `miss2027_${gameId}_ranking_tour3_${user.pseudo}`
        : `miss2027_${gameId}_selection_tour${tour}_${user.pseudo}`;

    const saved = localStorage.getItem(key);

    if (tour === 3) setRanking(saved ? JSON.parse(saved) : {});
    else setSelection(saved ? JSON.parse(saved) : []);
    if (tour === 1) {
      const savedFavorite = localStorage.getItem(`miss2027_${gameId}_favorite_tour1_${user.pseudo}`);
      setFavorite(savedFavorite ? Number(savedFavorite) : null);
    }
  }, [tour, hasVotedThisTour, user.pseudo, gameId]);

  // Sauvegarde locale live
  useEffect(() => {
    if (hasVotedThisTour || tour === 3) return;

    localStorage.setItem(
      `miss2027_selection_tour${tour}_${user.pseudo}`,
      JSON.stringify(selection)
    );
  }, [selection, tour, hasVotedThisTour, user.pseudo, gameId]);

  useEffect(() => {
    if (tour !== 1 || hasVotedThisTour || !gameId || gameId === "loading") return;
    const key = `miss2027_${gameId}_favorite_tour1_${user.pseudo}`;
    if (favorite == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(favorite));
  }, [tour, hasVotedThisTour, favorite, gameId, user.pseudo]);

  // Sauvegarde classement finale
  useEffect(() => {
    if (hasVotedThisTour || tour !== 3) return;

    localStorage.setItem(
      `miss2027_ranking_tour3_${user.pseudo}`,
      JSON.stringify(ranking)
    );
  }, [ranking, tour, hasVotedThisTour, user.pseudo, gameId]);

  // Sélection pour tour 1 & 2
  const handleClickMiss = (id) => {
    if (!votesOpen || hasVotedThisTour || tour === 3) return;
    if (selection.includes(id)) {
      setSelection(selection.filter((x) => x !== id));
      if (tour === 1 && favorite === id) setFavorite(null);
    }
    else if (selection.length < maxSelect)
      setSelection([...selection, id]);
  };

  const handleFavorite = (event, id) => {
    event.stopPropagation();
    if (tour !== 1 || !votesOpen || hasVotedThisTour || votePending || !selection.includes(id)) return;
    setFavorite(current => current === id ? null : id);
    setVoteFeedback("");
  };

  const getRankLabel = (rank) =>
    ["Miss France", "1ère dauphine", "2ème dauphine", "3ème dauphine", "4ème dauphine"][rank - 1];

  // Validation du vote
  const handleValidate = async () => {
    if (votePending) return;
    if (!votesOpen) { setVoteFeedback("Les votes ne sont pas ouverts."); return; }

    if (tour === 1 || tour === 2) {
      if (selection.length !== maxSelect) {
        setVoteFeedback(`Tu dois sélectionner ${maxSelect} Miss (actuellement ${selection.length}).`);
        return;
      }

      if (tour === 1 && !selection.includes(favorite)) {
        setVoteFeedback("❤️ Choisis ton coup de cœur parmi tes 12 Miss avant de valider.");
        return;
      }

      // Le clic sur « Valider mon vote » constitue la confirmation.
      // Éviter window.confirm, parfois bloqué dans les navigateurs intégrés sur mobile.
      setVotePending(true);
      setVoteFeedback("Enregistrement de ton vote en cours…");
      try {
        if (tour === 1) await updateFirstRoundWithFavorite(user.pseudo, selection, favorite);
        else await updatePlayerVote(user.pseudo, tour, selection);
        setVoteFeedback("Vote enregistré !");
        navigate("/waiting");
      } catch (error) {
        console.error("Échec enregistrement du vote :", error);
        setVoteFeedback(`Vote non enregistré (${error?.code || "erreur inconnue"}) : ${error?.message || "Réessaie ou contacte l’administrateur."}`);
      } finally {
        setVotePending(false);
      }
      return;
    }

    // ⭐ FINALE
    const ranks = Object.values(ranking);
    if (ranks.length !== candidates.length)
      return alert("Tu dois classer toutes les finalistes.");

    const needed = Array.from(
      { length: candidates.length },
      (_, i) => i + 1
    );

    if (!needed.every((r) => ranks.includes(r)))
      return alert("Chaque place doit être utilisée une seule fois.");

    if (!window.confirm("Envoyer ton classement final ?")) return;

    const ordered = [];
    for (let r = 1; r <= candidates.length; r++) {
      const entry = Object.entries(ranking).find(([, x]) => x === r);
      if (entry) ordered.push(Number(entry[0]));
    }

    try {
      await updatePlayerVote(user.pseudo, 3, ordered);
      navigate("/waiting");
    } catch (error) {
      console.error("Échec enregistrement du vote :", error);
        alert(`Vote non enregistré (${error?.code || "erreur inconnue"}). ${error?.message || "Réessaie ou contacte l’administrateur."}`);
    }
  };

  // Couleurs des choix du joueur, indépendamment des résultats officiels.
  // Vert : choix en cours, à tous les tours.
  const getBorderColor = (id) => {
    const t1P = playerData.tour1 || [];
    const t2P = playerData.tour2 || [];

    if (!hasVotedThisTour) {
      if (tour === 3 && ranking[id]) return "green";
      if (tour !== 3 && selection.includes(id)) return "green";
    }

    if (tour === 2) {
      return t1P.includes(id) ? "blue" : "grey";
    }

    if (tour === 3) {
      if (t1P.includes(id) && t2P.includes(id)) return "blue";
      if (t2P.includes(id)) return "yellow";
    }

    return "grey";
  };

  const getBorderClass = (id) =>
    ({
      blue: "border-blue",
      green: "border-green",
      yellow: "border-yellow",
      grey: "border-grey",
    }[getBorderColor(id)]);

  const usedRanks = Object.values(ranking);

  const subtitle =
    tour === 1
      ? "Tour 1 — sélectionne 12 miss"
      : tour === 2
      ? "Tour 2 — sélectionne 5 miss"
      : "Tour 3 — classe les finalistes";

  // =====================================================================================
  // RENDER
  // =====================================================================================

  return (
    <div className="tv-page tv-vote-page tv-show-v3">
      <style>{votePulseKeyframes}</style>

      {/* ⭐ Bannière votes ouverts */}
      {votesOpen && showVoteBanner && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(135deg, #0f0, #32cd32)",
            color: "#003300",
            fontWeight: "bold",
            padding: "15px 20px",
            textAlign: "center",
            fontSize: 18,
            zIndex: 9999,
            animation: "votePulse 2s infinite",
          }}
        >
          📢 <b>Les votes sont ouverts !!!</b>
          <br />
          Le temps limite est le même qu'à la télé.
          <br />
          <button
            onClick={() => setShowVoteBanner(false)}
            style={{
              marginTop: 10,
              background: "white",
              color: "green",
              border: "none",
              padding: "6px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            J’ai compris
          </button>
        </div>
      )}

      <header className="tv-show-header"><span className="tv-kicker">✦ MISS FRANCE 2027 · LE GRAND SHOW ✦</span><span className="tv-live-pill">● PRONOSTICS EN DIRECT</span><h1>À VOUS DE JOUER</h1><p>Bienvenue <strong>{user.pseudo}</strong></p><div className="tv-tour-tag">{subtitle}</div></header>

      {/* ⭐ Bannière votes fermés */}
      {!votesOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: "15px 20px",
            background: "linear-gradient(135deg, #d60013, #fc2445)",
            color: "white",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 18,
            boxShadow: "0 0 22px rgba(255,30,65,0.75)",
          }}
        >
          <div>LES VOTES SONT FERMÉS</div>
          <div style={{ fontSize: 15, marginTop: 4 }}>
            Patientez que Ludo ouvre les votes.
          </div>
        </div>
      )}

      {/* ⭐ Légende */}
      <div
        style={{
          margin: "20px auto",
          padding: 15,
          borderRadius: 10,
          background: "rgba(0,0,0,0.45)",
          maxWidth: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        {tour === 1 && <div style={{border:"1px solid rgba(255,134,180,.65)",borderRadius:12,padding:"13px 12px",marginBottom:15,background:"rgba(94,17,73,.42)",textAlign:"center"}}>
          <div style={{fontSize:19,fontWeight:900,color:"#ffe0ac",marginBottom:6}}>❤️ TON COUP DE CŒUR · +20 POINTS</div>
          <div style={{fontSize:14,lineHeight:1.5}}>Sélectionne 12 Miss, puis touche le petit cœur en haut à droite de celle que tu vois devenir <strong>Miss France 2027</strong> ! Si elle gagne, tu remportes <strong>20 points bonus</strong>.</div>
          <div style={{fontSize:13,marginTop:8,color:"#ffd3e5",fontWeight:800}}>{favorite && selection.includes(favorite) ? `❤️ Coup de cœur : ${CANDIDATES.find(c => c.id === favorite)?.label || "Miss choisie"}` : "♡ Choisis un seul coup de cœur parmi tes 12 Miss"}</div>
        </div>}
        <h3>◈ LE CODE COULEUR DU JEU</h3>

        <LegendItem colorClass="border-green" text={tour === 1 ? "Sélection des 12 Miss" : tour === 2 ? "Sélection des 5 Miss" : "Classement des 5 finalistes"} />
        {tour === 2 && <LegendItem colorClass="border-blue" text="Vous aviez déjà sélectionné cette Miss au premier tour." />}
        {tour === 3 && <>
          <LegendItem colorClass="border-blue" text="Vous avez sélectionné cette Miss aux deux premiers tours." />
          <LegendItem colorClass="border-yellow" text="Vous avez sélectionné cette Miss uniquement au deuxième tour." />
        </>}
        <LegendItem colorClass="border-grey" text="Jamais sélectionnée" />
      </div>

      <div className="tv-section-heading"><span>✦ LE CASTING · LES CANDIDATES</span><strong>{tour === 1 ? `${selection.length} / 12` : tour === 2 ? `${selection.length} / 5` : "CLASSEMENT FINAL"}</strong></div>
      {/* ⭐ Tours 1 & 2 */}
      {tour !== 3 && (
        <div className="grid">
          {candidates.map((miss) => (
            <div
              key={miss.id}
              className={`miss-card tv-contestant ${getBorderClass(miss.id)}`}
              onClick={() => handleClickMiss(miss.id)}
              style={{
                cursor:
                  !votesOpen || hasVotedThisTour ? "default" : "pointer",
                textAlign: "center",
                borderWidth: 5,
              }}
            >
              <img
                src={miss.image}
                alt={miss.label}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 10,
                  marginBottom: 4,
                }}
              />
              {tour === 1 && <button
                type="button"
                aria-label={favorite === miss.id ? `Retirer ${miss.label} des coups de cœur` : `Choisir ${miss.label} comme coup de cœur`}
                aria-pressed={favorite === miss.id}
                title={selection.includes(miss.id) ? "Mon coup de cœur" : "Sélectionne d’abord cette Miss"}
                disabled={!votesOpen || hasVotedThisTour || votePending || !selection.includes(miss.id)}
                onClick={(event) => handleFavorite(event, miss.id)}
                style={{
                  position: "absolute", top: 9, right: 9, zIndex: 5,
                  width: 38, height: 38, minHeight: 0,
                  display: "grid", placeItems: "center", padding: 0,
                  borderRadius: "50%",
                  background: favorite === miss.id ? "#c71b62" : "rgba(8,14,38,.76)",
                  color: favorite === miss.id ? "#fff" : "#ffc5d8",
                  border: favorite === miss.id ? "2px solid #ffe0ee" : "1px solid rgba(255,210,227,.8)",
                  fontSize: 25, lineHeight: 1,
                  boxShadow: favorite === miss.id ? "0 0 20px rgba(255,78,145,.8)" : "0 2px 9px rgba(0,0,0,.45)",
                  opacity: selection.includes(miss.id) ? 1 : .45,
                  cursor: selection.includes(miss.id) ? "pointer" : "default"
                }}
              >{favorite === miss.id ? "♥" : "♡"}</button>}
              {tour === 2 && Number(playerData.favorite) === miss.id && <span title="Ton coup de cœur du premier tour" aria-label="Coup de cœur du premier tour" style={{position:"absolute",top:9,right:9,zIndex:5,fontSize:24,color:"#ff6a9e",textShadow:"0 0 10px rgba(255,84,154,.8)",background:"rgba(9,14,40,.85)",width:35,height:35,borderRadius:"50%",display:"grid",placeItems:"center"}}>♥</span>}
              <div className="tv-contestant-label"><span>{miss.label}</span><span aria-hidden="true">✦</span></div>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ Tour 3 */}
      {tour === 3 && (
        <div className="grid">
          {candidates.map((miss) => (
            <div
              key={miss.id}
              className={`miss-card ${getBorderClass(miss.id)}`}
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
                  height: "auto",
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              />
              {Number(playerData.favorite) === miss.id && <span title="Ton coup de cœur du premier tour" aria-label="Coup de cœur du premier tour" style={{position:"absolute",top:9,right:9,zIndex:5,fontSize:24,color:"#ff6a9e",textShadow:"0 0 10px rgba(255,84,154,.8)",background:"rgba(9,14,40,.85)",width:35,height:35,borderRadius:"50%",display:"grid",placeItems:"center"}}>♥</span>}
              <div className="tv-contestant-label" style={{ marginBottom: 8 }}>{miss.label}</div>

              <select
                value={ranking[miss.id] || ""}
                onChange={(e) => {
                  const newRank = Number(e.target.value);
                  setRanking((prev) => {
                    const updated = { ...prev };

                    Object.keys(updated).forEach((mid) => {
                      if (updated[mid] === newRank) delete updated[mid];
                    });

                    updated[miss.id] = newRank;
                    return updated;
                  });
                }}
                disabled={!votesOpen || hasVotedThisTour}
                style={{
                  width: "100%",
                  padding: 6,
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <option value="">— Choisir un rang —</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option
                    key={r}
                    value={r}
                    disabled={
                      usedRanks.includes(r) && ranking[miss.id] !== r
                    }
                  >
                    {getRankLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ Bouton validation */}
      <div className="tv-submit" style={{ textAlign: "center", marginTop: 20 }}>
        <button
          onClick={handleValidate}
          disabled={!votesOpen || hasVotedThisTour || votePending}
        >
          {votePending ? "Enregistrement…" : tour === 3 ? "Valider mon classement" : "Valider mon vote"}
        </button>
        {voteFeedback && <p role="status" aria-live="polite" style={{ color: "#ffe4a0", padding: "8px", fontWeight: 700 }}>{voteFeedback}</p>}
      </div>

      <Leaderboard />
      <ChatBubble user={user} />

      {/* ⭐⭐ Bulle bleue sélection ⭐⭐ */}
      <SelectionBubble user={user} tour={tour} selection={selection} />

      {/* ⭐ Déconnexion (totale) */}
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <button
          onClick={handleLogout}
          style={{
            background: "crimson",
            color: "white",
            padding: "10px 25px",
            borderRadius: 10,
            border: "none",
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ⛔ Déconnexion
        </button>
      </div>
    </div>
  );
}

// Légende
function LegendItem({ colorClass, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        className={`miss-card ${colorClass}`}
        style={{
          width: 40,
          height: 20,
          padding: 0,
          boxShadow: "none",
          borderWidth: 4,
        }}
      ></span>
      <span>{text}</span>
    </div>
  );
}
