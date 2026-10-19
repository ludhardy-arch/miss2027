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
  const [votesExpanded, setVotesExpanded] = useState(false);
  const [rankExpanded, setRankExpanded] = useState(false);

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
  const playerEntries = Object.entries(players || {});
  const totalPlayers = playerEntries.length;
  const votedCount = playerEntries.filter(([, player]) => playerHasVoted(player)).length;
  const standings = playerEntries.map(([pseudo, player]) => ({ pseudo, points: calculatePoints(player, adminSelections) }))
    .sort((a,b) => b.points-a.points || a.pseudo.localeCompare(b.pseudo,"fr"));
  const popularity = candidates.map(miss => ({
    ...miss,
    count: playerEntries.filter(([,p]) => {
      const votes = p?.[`tour${tour}`];
      return (Array.isArray(votes) ? votes : Object.values(votes || {})).map(Number).includes(miss.id);
    }).length
  })).sort((a,b) => b.count-a.count || a.label.localeCompare(b.label,"fr")).slice(0,5);


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
        <div className="regie-kpi"><span className="regie-kpi-icon">♙</span><strong>{totalPlayers}</strong><span>JOUEURS</span></div>
        <button type="button" className="regie-kpi" aria-expanded={votesExpanded} onClick={()=>setVotesExpanded(x=>!x)}><span className="regie-kpi-icon green">✓</span><strong>{votedCount}/{totalPlayers}</strong><span>VOTES VALIDÉS {votesExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={rankExpanded} onClick={()=>setRankExpanded(x=>!x)}><span className="regie-kpi-icon gold">🏆</span><strong>🏆</strong><span>CLASSEMENT {rankExpanded?"⌃":"⌄"}</span></button>
      </section>
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
          {popularity.map(m=><div className="regie-popularity" key={m.id}><div><span>{m.label}</span><strong>{totalPlayers?Math.round(100*m.count/totalPlayers):0}%</strong></div><div className="regie-meter"><span style={{width:(totalPlayers?100*m.count/totalPlayers:0)+"%"}} /></div><small>{m.count} vote(s)</small></div>)}
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
        <button onClick={handleValidate}>
          Valider {tour === 3 ? "le classement" : "la sélection"}
        </button>
      </div>


    </div>
  );
}
