// src/pages/Admin.jsx

import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { calculatePoints } from "../services/points";
import AdminLiveChat from "../components/AdminLiveChat";
import "./AdminRegie.css";
import FinaleOverlay from "../components/FinaleOverlay";

import { CANDIDATES } from "../data/candidates";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { database } from "../firebase";
import { ref, push, set } from "firebase/database";

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
    demoEnabled,
    demoLoaded,
    updateDemoEnabled,
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
  const [savingFinalRanking, setSavingFinalRanking] = useState(false);
  const [votesExpanded, setVotesExpanded] = useState(false);
  const [rankExpanded, setRankExpanded] = useState(false);
  const [playersExpanded, setPlayersExpanded] = useState(false);
  const [moderationBusy, setModerationBusy] = useState("");

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

  // Confirmation visible seulement si le classement affiché correspond
  // au classement officiel enregistré et synchronisé depuis Firebase.
  const finalRankingOrder = [1, 2, 3, 4, 5].map(rank => {
    const entry = Object.entries(ranking).find(([, value]) => value === rank);
    return entry ? Number(entry[0]) : null;
  });
  const savedFinalRanking = adminSelections.tour3;
  const finalRankingValidated = tour === 3 &&
    Array.isArray(savedFinalRanking) &&
    savedFinalRanking.length === 5 &&
    finalRankingOrder.every((id, index) => id !== null && Number(savedFinalRanking[index]) === id);

  const handleValidate = async () => {
    if (savingFinalRanking) return;
    if (tour === 3 && finalRankingValidated) return;
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

    setSavingFinalRanking(true);
    try {
      await updateAdminSelections(3, ordered);
    } catch (error) {
      reportActionError(error);
    } finally {
      setSavingFinalRanking(false);
    }
  };

  const playerHasVoted = (p) => {
    if (!p) return false;
    const t = p[`tour${tour}`];
    return t && (Array.isArray(t) ? t.length > 0 : Object.keys(t).length > 0);
  };

  const getBorderClass = (id) =>
    selection.includes(id) ? "border-blue" : "border-grey";

  const usedRanks = Object.values(ranking).filter(Boolean);
  const playerEntries = Object.entries(players || {});
  const totalPlayers = playerEntries.length;
  const warnPlayer = async (pseudo, player) => {
    if (!player?.uid) return alert("Impossible d’identifier le joueur Firebase.");
    if (!window.confirm(`Envoyer un dernier avertissement à ${pseudo} ?`)) return;
    setModerationBusy(pseudo);
    try {
      await push(ref(database, "rooms/miss2027/chat"), {
        author: "admin",
        targetUid: player.uid,
        text: `❌ ${pseudo}, tu dépasses les limites, dernier avertissement !!!`,
        date: Date.now()
      });
    } catch (error) { reportActionError(error); }
    finally { setModerationBusy(""); }
  };
  const toggleChatBlock = async (pseudo, player) => {
    if (!player?.uid) return alert("Impossible d’identifier le joueur Firebase.");
    const blocked = player.chatBlocked === true;
    if (!window.confirm(blocked ? `Rétablir le chat pour ${pseudo} ?` : `Empêcher ${pseudo} d’écrire dans le chat ?`)) return;
    setModerationBusy(pseudo);
    try {
      await set(ref(database, `rooms/miss2027/players/${pseudo}/chatBlocked`), !blocked);
    } catch (error) { reportActionError(error); }
    finally { setModerationBusy(""); }
  };
  const votedCount = playerEntries.filter(([, player]) => playerHasVoted(player)).length;
  const standings = playerEntries.map(([pseudo, player]) => ({ pseudo, points: calculatePoints(player, adminSelections) }))
    .sort((a,b) => b.points-a.points || a.pseudo.localeCompare(b.pseudo,"fr"));
  // Cumulative popularity: 1 point per selection in rounds 1 and 2;
  // in the final, ordered predictions award 5 to Miss France, then 4, 3, 2, 1.
  const voteIds = (votes) => (Array.isArray(votes) ? votes : Object.values(votes || {})).map(Number);
  const popularity = CANDIDATES.map(miss => ({
    ...miss,
    count: playerEntries.reduce((sum, [, player]) => {
      const round1 = voteIds(player?.tour1).includes(miss.id) ? 1 : 0;
      const round2 = voteIds(player?.tour2).includes(miss.id) ? 1 : 0;
      const finalIndex = voteIds(player?.tour3).indexOf(miss.id);
      return sum + round1 + round2 + (finalIndex >= 0 ? 5 - finalIndex : 0);
    }, 0)
  })).sort((a,b) => b.count-a.count || a.label.localeCompare(b.label,"fr")).slice(0,5);
  const maxPopularity = Math.max(1, ...popularity.map(m => m.count));

  return (
    <div className="tv-page tv-admin-page tv-show-v3">
      <style>{votePulseKeyframes}</style>

      {finaleStarted && (
        <FinaleOverlay
          players={players}
          adminSelections={adminSelections}
          isAdmin={true}
        />
      )}

      <header className="regie-header">
        <div><span className="regie-eyebrow">♛ MISS FRANCE 2027</span><h1>RÉGIE DU DIRECT</h1><p>PILOTAGE DU CONCOURS <strong>TOUR {tour} / 3</strong></p></div>
        <div className="regie-header-right"><span className="regie-live">● LIVE</span><button type="button" className="regie-logout" disabled={loggingOut} onClick={handleLogout}>↪ {loggingOut?"Déconnexion…":"Se déconnecter"}</button></div>
      </header>

      <section className="regie-kpis" aria-label="Statistiques du concours">
        <button type="button" className="regie-kpi" aria-expanded={playersExpanded} onClick={()=>setPlayersExpanded(x=>!x)}><span className="regie-kpi-icon">♙</span><strong>{totalPlayers}</strong><span>JOUEURS {playersExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={votesExpanded} onClick={()=>setVotesExpanded(x=>!x)}><span className="regie-kpi-icon green">✓</span><strong>{votedCount}/{totalPlayers}</strong><span>VOTES VALIDÉS {votesExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={rankExpanded} onClick={()=>setRankExpanded(x=>!x)}><span className="regie-kpi-icon gold">🏆</span><strong>TOP</strong><span>CLASSEMENT {rankExpanded?"⌃":"⌄"}</span></button>
      </section>
      {playersExpanded && <section className="regie-expand" aria-label="Modération des joueurs">
        <h3>JOUEURS INSCRITS · MODÉRATION DU CHAT</h3>
        <p className="regie-muted" style={{fontSize:12}}>Les joueurs enregistrés sont listés ici (leur présence en ligne n’est pas vérifiée).</p>
        <div style={{display:"grid",gap:10}}>
          {playerEntries.map(([pseudo,player])=>(
            <div key={pseudo} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",padding:"12px",background:"rgba(18,35,75,.8)",border:"1px solid rgba(128,175,245,.35)",borderRadius:12}}>
              <strong style={{overflowWrap:"anywhere"}}>{pseudo} {player?.chatBlocked===true && <span style={{color:"#ffb4b4",fontSize:12}}>· Chat bloqué</span>}</strong>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <button type="button" disabled={moderationBusy===pseudo || !player?.uid} onClick={()=>warnPlayer(pseudo,player)} style={{background:"#7d4310",padding:"9px 11px",fontSize:12}}>⚠️ Avertir</button>
                <button type="button" disabled={moderationBusy===pseudo || !player?.uid} onClick={()=>toggleChatBlock(pseudo,player)} style={{background:player?.chatBlocked===true?"#176849":"#8a2038",padding:"9px 11px",fontSize:12}}>{player?.chatBlocked===true?"🔓 Débloquer":"🔇 Bloquer chat"}</button>
              </div>
            </div>
          ))}
          {totalPlayers===0 && <p className="regie-muted">Aucun joueur inscrit.</p>}
        </div>
      </section>}
      {votesExpanded && <section className="regie-expand"><h3>SUIVI DES VOTES · TOUR {tour}</h3><div className="regie-player-grid">{playerEntries.map(([pseudo,player])=><div key={pseudo} className={"regie-player-status "+(playerHasVoted(player)?"yes":"no")}><span>{pseudo}</span><b>{playerHasVoted(player)?"✓ VOTÉ":"✕ PAS VOTÉ"}</b></div>)}</div>{totalPlayers===0&&<p>Aucun joueur enregistré.</p>}</section>}
      {rankExpanded && <section className="regie-expand"><h3>CLASSEMENT DES JOUEURS</h3><div className="regie-standing-list">{standings.map((p,i)=><div key={p.pseudo}><strong>{i===0?"👑":String(i+1).padStart(2,"0")}</strong><span>{p.pseudo}</span><b>{p.points} pts</b></div>)}</div>{!standings.length&&<p>Aucun score pour le moment.</p>}</section>}

      <section className="regie-controls"><h2>COMMANDES DE LA RÉGIE</h2><div className="regie-control-grid">
        <button type="button" className={"regie-switch "+(connectionsOpen?"is-on":"is-off")} onClick={()=>safely(()=>updateConnectionsOpen(!connectionsOpen))}><span>⇥</span><b>CONNEXIONS</b><strong>{connectionsOpen?"ON":"OFF"}</strong></button>
        <button type="button" className={"regie-switch "+(votesOpen?"is-on":"is-off")} onClick={()=>safely(()=>updateVotesOpen(!votesOpen))}><span>✉</span><b>VOTES</b><strong>{votesOpen?"ON":"OFF"}</strong></button>
        <button type="button" disabled={!demoLoaded} className={"regie-switch "+(demoEnabled?"is-on":"is-off")} onClick={()=>safely(()=>updateDemoEnabled(!demoEnabled))}><span>▣</span><b>MODE DÉMO</b><strong>{!demoLoaded?"…":demoEnabled?"ON":"OFF"}</strong></button>
        <button type="button" className="regie-show" disabled={tour!==3 || finaleStarted} onClick={()=>{if(window.confirm("Lancer le show final maintenant ?"))safely(()=>updateFinaleStarted(true));}}><span>♛</span><b>SHOW FINAL</b><strong>{finaleStarted?"SHOW LANCÉ":"LANCER LE SHOW"}</strong></button>
      </div></section>

      <div className="regie-info-grid">
        <AdminLiveChat user={user} />
        <section className="regie-panel"><div className="regie-panel-heading"><h3>⭐ MISS FAVORITES</h3><span>TOUR {tour}</span></div>
          {popularity.map(m=><div className="regie-popularity" key={m.id}><div><span>{m.label}</span><strong>{m.count} pts</strong></div><div className="regie-meter"><span style={{width:(100*m.count/maxPopularity)+"%"}} /></div><small>Cumul des sélections · tours 1, 2 et finale</small></div>)}
          {!popularity.length&&<p>Aucune candidate à afficher.</p>}
        </section>
      </div>

      <details className="regie-danger" open={showDangerZone} onToggle={event=>setShowDangerZone(event.currentTarget.open)}>
        <summary>⚠️ Zone sensible — Réinitialiser la partie</summary>
        <p>Cette action efface tous les joueurs, votes et résultats du jeu. Elle est irréversible.</p>
        <label htmlFor="reset-confirm">Écris <strong>RESET</strong> pour confirmer :</label>
        <input id="reset-confirm" value={resetConfirmation} onChange={event=>setResetConfirmation(event.target.value)} autoComplete="off" />
        <button disabled={resetConfirmation!=="RESET"} onClick={()=>{
          if(!window.confirm("Dernière confirmation : effacer définitivement toute la partie ?"))return;
          safely(async()=>{await resetGame();setResetConfirmation("");setShowDangerZone(false);});
        }}>Supprimer la partie et recommencer</button>
      </details>

      <h2 className="regie-selection-heading">♛ SÉLECTION OFFICIELLE DES MISS</h2>
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

                      if (newRank && !Object.values(updated).includes(newRank)) {
                        updated[miss.id] = newRank;
                      }
                      return updated;
                    });
                  }}
                  style={{ width: "100%", padding: 8, borderRadius: 8 }}
                >
                  <option value="">— Choisir —</option>
                  {[1, 2, 3, 4, 5].filter((r) => r === ranking[miss.id] || !Object.entries(ranking).some(([id, assigned]) => Number(id) !== miss.id && assigned === r)).map((r) => (
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
        <button
          onClick={handleValidate}
          type="button"
          disabled={savingFinalRanking || finalRankingValidated}
          style={finalRankingValidated ? {
            background: "linear-gradient(120deg, #075b3f, #12835a)",
            border: "2px solid #55e8a8",
            color: "white",
            boxShadow: "0 0 18px rgba(47, 232, 148, .35)",
            opacity: 1,
            cursor: "default",
            padding: "12px 24px"
          } : undefined}
        >
          {tour === 3
            ? (savingFinalRanking ? "Enregistrement…" : finalRankingValidated ? "✅ Classement validé" : "Valider le classement")
            : "Valider la sélection"}
        </button>
      </div>


    </div>
  );
}
