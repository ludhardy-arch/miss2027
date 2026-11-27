// src/pages/Admin.jsx

import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { calculatePoints } from "../services/points";
import "./AdminRegie.css";

import { CANDIDATES } from "../data/candidates";
import { auth,adminSession } from "../firebase";
import {testPlayerUrl} from "../testPlayerSession.mjs";
import ChatBubble from "../components/ChatBubble";
import {getReadMarker,saveReadMarker,newest,countUnread,emptyMarker} from "../chatUnread.mjs";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { database } from "../firebase";
import { ref, get } from "firebase/database";

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
      // Dedicated admin auth: no player session storage mutation.
      setUser(null);
      navigate("/admin", { replace: true });
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
    tour,
    adminSelections,
    gameId,
    finaleStarted,
  } = useContext(AppContext);

  const [controlBusy,setControlBusy]=useState(false);
  const [nationalView,setNationalView]=useState(null);
  const [nationalError,setNationalError]=useState("");
  const players=nationalView?.players||{};
  const [chatGroup,setChatGroup]=useState("");
  const groups=Array.isArray(nationalView?.groups)?nationalView.groups:[...new Map(Object.values(players).map(p=>[p.groupId,p.groupName])).entries()].map(([id,name])=>({id,name,memberCount:Object.values(players).filter(p=>p.groupId===id).length}));
  const chatRooms=groups.map(g=>[g.id,g.name]);
  const [readMarkers,setReadMarkers]=useState({});
  const chatSummary=nationalView?.chatSummary||{};
  const alertRooms=groups.filter(g=>(chatSummary[g.id]?.alerts||0)>0);
  const unreadFor=id=>{const rows=chatSummary[id]?.messages||[],mark=readMarkers[id]||getReadMarker(user.uid,id);return mark?countUnread(rows,mark,user.uid):0;};
  useEffect(()=>{for(const [id,data] of Object.entries(chatSummary)){if(!getReadMarker(user.uid,id))saveReadMarker(user.uid,id,newest(data.messages,emptyMarker));}},[nationalView,user.uid]);
  const chatRead=React.useCallback(mark=>{setReadMarkers(old=>({...old,[chatGroup]:mark}));},[chatGroup]);
  const refreshReports=React.useCallback(()=>{adminRequest("/admin/game").then(setNationalView).catch(()=>{});},[user.uid]);
  const chatRequest=React.useCallback(body=>body===undefined?adminRequest("/admin/chat?groupId="+encodeURIComponent(chatGroup)):adminRequest("/admin/chat",{...body,groupId:chatGroup}),[chatGroup,user.uid]);
  async function moderate(player,action){
    if(!window.confirm((action==="warn"?"Avertir ":action==="block"?"Bloquer ":"Débloquer ")+player.pseudo+" ?"))return;
    try{await adminRequest("/admin/chat",{groupId:player.groupId,targetUid:player.uid,action});setNationalView(await adminRequest("/admin/game"));}catch(e){reportActionError(e);}
  }
  async function removeMember(player){
    if(removing||finaleStarted||!gameId||gameId==="loading")return;
    const owner=groups.find(g=>g.id===player.groupId)?.ownerPseudo===player.pseudo;
    if(!window.confirm("Retirer "+player.pseudo+" du groupe "+player.groupName+" ? Ses votes seront annulés et sa participation bloquée."+ (owner?" Si d’autres membres restent, le plus ancien devient créateur.":"")))return;
    setRemoving(player.uid);
    try{
      const result=await adminRequest("/admin/player/remove",{targetUid:player.uid,groupId:player.groupId,gameId:String(gameId),confirmed:true});
      if(result.accepted!==true||result.removedUid!==player.uid)throw Error("Retrait non confirmé.");
      setNationalView(await adminRequest("/admin/game"));
    }catch(e){reportActionError(e);}finally{setRemoving(null);}
  }
  async function adminRequest(path,body){
    const current=auth.currentUser;
    if(!adminSession||window.location.origin!=="https://miss2027-test.onrender.com"||!current||current.uid!==import.meta.env.VITE_ADMIN_UID)throw Error("Action réservée à la régie test.");
    const token=await current.getIdToken();
    const res=await fetch("https://miss2027-test-api.onrender.com"+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000),cache:"no-store"});
    const data=await res.json();
    if(!res.ok)throw Error(({close_votes_first:"Ferme les votes avant de valider.",game_changed:"La partie a changé.",round_changed:"Le tour a changé.",invalid_vote:"Sélection officielle non valide.",invalid_member:"Ce joueur ne fait plus partie de ce groupe.",game_finished:"Les résultats sont déjà publiés."})[data.error]||"Serveur de la régie indisponible.");
    return data;
  }
  async function toggleControl(kind,open){
    if(controlBusy||!gameId||gameId==="loading")return;
    setControlBusy(true);
    try{await adminRequest("/admin/"+kind,{gameId:String(gameId),open});setNationalView(await adminRequest("/admin/game"));}catch(e){reportActionError(e);}finally{setControlBusy(false);}
  }
  useEffect(()=>{
    let active=true,busy=false;
    const poll=async()=>{
      if(!active||busy)return;busy=true;
      try{const data=await adminRequest("/admin/game");if(active){setNationalView(data);setNationalError("");}}
      catch(err){if(active)setNationalError(err.message);}
      finally{busy=false;}
    };
    void poll();const timer=setInterval(poll,10000);
    return()=>{active=false;clearInterval(timer);};
  },[user.uid,gameId,tour]);
  const [selection, setSelection] = useState([]);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [resetKind,setResetKind]=useState("");
  const [resetConfirmation,setResetConfirmation]=useState("");
  const [resetBusy,setResetBusy]=useState(false);
  const [resetFeedback,setResetFeedback]=useState("");
  const [ranking, setRanking] = useState({});
  const [savingFinalRanking, setSavingFinalRanking] = useState(false);
  const [publishing,setPublishing]=useState(false);
  const [advancingTour, setAdvancingTour] = useState(false);
  const [votesExpanded, setVotesExpanded] = useState(false);
  const [rankExpanded, setRankExpanded] = useState(false);
  const [expandedGroup,setExpandedGroup]=useState(null);
  const [removing,setRemoving]=useState(null);
  const [favoritesExpanded,setFavoritesExpanded]=useState(false);
  const [groupsExpanded,setGroupsExpanded]=useState(false);
  const resetWord=resetKind==="game"?"JEU":"INSCRIPTIONS";
  async function confirmReset(){
    if(resetBusy||!resetKind||resetConfirmation!==resetWord)return;
    if(!window.confirm(resetKind==="game"?"Dernière confirmation : effacer les votes et résultats, sans supprimer les inscriptions ?":"Dernière confirmation : supprimer tous les joueurs, groupes et invitations ?"))return;
    setResetBusy(true);setResetFeedback("");
    try{
      const current=auth.currentUser;
      if(!adminSession||window.location.origin!=="https://miss2027-test.onrender.com"||!current||current.uid!==import.meta.env.VITE_ADMIN_UID)throw Error("Action réservée à la régie test.");
      const token=await current.getIdToken();
      const response=await fetch("https://miss2027-test-api.onrender.com/admin/reset",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({kind:resetKind,confirmation:resetConfirmation,confirmed:true}),signal:AbortSignal.timeout(90000),cache:"no-store"});
      const result=await response.json();
      if(!response.ok){
        const labels={votes_open:"votes ouverts",finale:"finale lancée",round:"tour déjà avancé",votes_exist:"votes enregistrés",official_selections:"sélections officielles enregistrées",results_exist:"résultats existants"};
        const why=(result.reasons||[]).map(code=>labels[code]||code).join(", ");
        const messages={reset_not_verified:"Impossible de confirmer la suppression dans Firebase.",conflict:"Conflit de données : aucune confirmation de suppression.",reset_game_first:"Remets d’abord le jeu à zéro avant de supprimer les inscriptions.",admin_required:"Compte administrateur non autorisé.",room_not_initialized:"La régie n’est pas encore initialisée.",too_many_requests:"Réessaie dans une minute.",test_registration_disabled:"Serveur test indisponible."};
        throw Error((messages[result.error]||"Réinitialisation refusée.")+(why?" ("+why+")":""));
      }
      if(result.kind!==resetKind||!result.gameId||result.verified!==true||(resetKind==="registrations"&&(result.remaining?.groups!==0||result.remaining?.players!==0)))throw Error("Réponse inattendue : vérifie les données avant de recommencer.");
      setResetFeedback(resetKind==="game"?"Jeu remis à zéro. Joueurs et groupes conservés.":`${result.before?.groups??0} groupe(s) et ${result.before?.players??0} inscription(s) supprimés. Vérification Firebase : 0 groupe, 0 joueur.`);
      setResetKind("");setResetConfirmation("");
      setNationalView(await adminRequest("/admin/game"));
    }catch(err){const message="Attention : "+(err.message||"réponse inconnue")+". Vérifie l’état du concours avant toute nouvelle tentative.";setResetFeedback(message);window.alert(message);}
    finally{setResetBusy(false);}
  }

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

  async function launchShow(){
    if(publishing||votesOpen||finaleStarted||!finalRankingValidated)return;
    if(!window.confirm("Lancer définitivement le show pour toutes les salles ? Les résultats seront figés."))return;
    setPublishing(true);
    try{await adminRequest("/admin/finale",{gameId:String(gameId),confirmed:true});setNationalView(await adminRequest("/admin/game"));}catch(e){reportActionError(e);}finally{setPublishing(false);}
  }
  const handleValidate = async () => {
    if (savingFinalRanking) return;
    if (tour === 3 && finalRankingValidated) return;
    if (tour < 3) {
      if (advancingTour) return;
      if (votesOpen) {
        alert("⛔ Fermez les votes avant de valider la sélection officielle et de passer au tour suivant.");
        return;
      }
      if (selection.length !== maxSelect) {
        alert(`Vous devez sélectionner ${maxSelect} Miss.`);
        return;
      }

      setAdvancingTour(true);
      try {
        // Relecture Firebase : la simple valeur affichée peut dater de quelques instants.
        const votesSnapshot = await get(ref(database, "rooms/miss2027/votesOpen"));
        if (votesSnapshot.val() !== false) {
          alert("⛔ Les votes sont ouverts dans Firebase. Fermez-les avant de changer de tour.");
          return;
        }

        const latest=await adminRequest("/admin/game");
        if(latest.gameId!==String(gameId)||latest.tour!==tour||latest.votesOpen)throw Error("Le concours a changé. Actualise avant de continuer.");
        setNationalView(latest);
        const missingPlayers = Object.entries(latest.players || {})
          .filter(([, player]) => {
            const vote = player?.[`tour${tour}`];
            return !(Array.isArray(vote) ? vote.length > 0 : vote && Object.keys(vote).length > 0);
          }).map(([,p]) => p.pseudo+" · "+p.groupName);

        if (missingPlayers.length > 0) {
          const names = missingPlayers.slice(0, 8).join(", ");
          const extra = missingPlayers.length > 8 ? "…" : "";
          const message = `⚠️ ${missingPlayers.length} joueur(s) sur ${Object.keys(latest.players || {}).length} n'ont pas voté au tour ${tour}.\n${names}${extra}\n\nPasser au tour suivant malgré les votes manquants ?`;
          if (!window.confirm(message)) return;
        }

        if (!window.confirm(`Valider les ${maxSelect} Miss officielles et passer au tour ${tour + 1} ?`)) return;

        // Vérification finale juste avant l'écriture.
        const latestVotes = await get(ref(database, "rooms/miss2027/votesOpen"));
        if (latestVotes.val() !== false) {
          alert("⛔ Les votes ont été rouverts. Passage de tour annulé.");
          return;
        }
        await adminRequest("/admin/round",{gameId:String(gameId),tour,selection});
        setNationalView(await adminRequest("/admin/game"));
      } catch (error) {
        reportActionError(error);
      } finally {
        setAdvancingTour(false);
      }
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
      await adminRequest("/admin/round",{gameId:String(gameId),tour:3,selection:ordered});
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
  const votedCount = playerEntries.filter(([, player]) => playerHasVoted(player)).length;
  const standings = playerEntries.map(([uid, player]) => ({ uid, pseudo:player.pseudo+" · "+player.groupName, points: calculatePoints(player, adminSelections) }))
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

      {finaleStarted && <p role="status">Show national lancé : résultats figés.</p>}

      <header className="regie-header">
        <div><span className="regie-eyebrow">♛ MISS FRANCE 2027</span><h1>RÉGIE DU DIRECT</h1><p>PILOTAGE DU CONCOURS <strong>TOUR {tour} / 3</strong></p></div>
        <div className="regie-header-right"><span className="regie-live">● LIVE</span><button type="button" className="regie-logout" disabled={loggingOut} onClick={handleLogout}>↪ {loggingOut?"Déconnexion…":"Se déconnecter"}</button></div>
      </header>

      <div style={{textAlign:"right",margin:"10px 0"}}><button type="button" onClick={()=>{const url=testPlayerUrl(window.location.href,crypto.randomUUID());if(url)window.open(url,"_blank","noopener,noreferrer");}} style={{fontSize:13,padding:"10px 14px"}}>＋ Simuler un nouveau joueur</button></div>
      {nationalError&&<p role="alert" style={{color:"#ffb3b3"}}>Statistiques non actualisées : {nationalError}</p>}
      {!nationalView&&!nationalError&&<p role="status">Chargement des inscriptions…</p>}
      {nationalView&&<p className="regie-muted">{nationalView.groupCount} salles et groupes · suivi national</p>}
      <section className="regie-kpis" aria-label="Statistiques du concours">
        <button type="button" className="regie-kpi" aria-expanded={groupsExpanded} onClick={()=>setGroupsExpanded(x=>!x)}><span className="regie-kpi-icon">♟</span><strong>{nationalView?groups.length:"…"}</strong><span>GROUPES CRÉÉS {groupsExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={votesExpanded} onClick={()=>setVotesExpanded(x=>!x)}><span className="regie-kpi-icon green">✓</span><strong>{nationalView?`${votedCount}/${totalPlayers}`:"…"}</strong><span>VOTES VALIDÉS {votesExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={rankExpanded} onClick={()=>setRankExpanded(x=>!x)}><span className="regie-kpi-icon gold">🏆</span><strong>TOP</strong><span>CLASSEMENT {rankExpanded?"⌃":"⌄"}</span></button>
        <button type="button" className="regie-kpi" aria-expanded={favoritesExpanded} onClick={()=>setFavoritesExpanded(x=>!x)}><span className="regie-kpi-icon gold">★</span><strong>TOP 5</strong><span>MISS FAVORITES {favoritesExpanded?"⌃":"⌄"}</span></button>
      </section>
      {favoritesExpanded&&<section className="regie-expand"><div className="regie-panel-heading"><h3>⭐ MISS FAVORITES</h3><span>TOUR {tour}</span></div>
        {popularity.map(m=><div className="regie-popularity" key={m.id}><div><span>{m.label}</span><strong>{m.count} pts</strong></div><div className="regie-meter"><span style={{width:(100*m.count/maxPopularity)+"%"}} /></div></div>)}
        <small className="regie-muted">Cumul des sélections · tours 1, 2 et finale</small>
      </section>}
      {groupsExpanded&&<section className="regie-expand" aria-label="Groupes et salles créés">
        <h3>GROUPES ET SALLES CRÉÉS</h3>
        <div className="regie-group-list">
          {groups.map(g=>{
            const members=playerEntries.filter(([,player])=>player.groupId===g.id).sort(([,a],[,b])=>a.pseudo.localeCompare(b.pseudo,"fr"));
            const opened=expandedGroup===g.id;
            return <div className="regie-group-card" key={g.id}>
              <button type="button" className="regie-group-toggle" aria-expanded={opened} onClick={()=>setExpandedGroup(old=>old===g.id?null:g.id)}>
                <span><strong>{g.name}</strong><small>{g.type==="public"?"Salle publique":g.type==="private"?"Groupe privé"+(g.ownerPseudo?" · Créateur : "+g.ownerPseudo:""):""}</small></span>
                <b>{g.memberCount}/30</b><span aria-hidden="true">{opened?"⌃":"⌄"}</span>
              </button>
              {opened&&<div className="regie-group-members">
                <p className="regie-muted" style={{fontSize:12,margin:"0 0 4px"}}>Joueurs inscrits · Modération du chat</p>
                {members.map(([uid,player])=>(
                  <div key={uid} className="regie-group-member">
                    <strong style={{overflowWrap:"anywhere"}}>{player.pseudo}{g.ownerPseudo===player.pseudo&&<span style={{color:"#f1ce91",fontSize:12}}> · Créateur</span>}{player.chatBlocked===true&&<span style={{color:"#ffb4b4",fontSize:12}}> · Chat bloqué</span>}</strong>
                    <div className="regie-member-actions">
                      <button type="button" className="regie-member-warn" onClick={()=>void moderate(player,"warn")}>Avertir</button>
                      <button type="button" className={player.chatBlocked?"regie-member-unblock":"regie-member-block"} onClick={()=>void moderate(player,player.chatBlocked?"unblock":"block")} aria-label={player.chatBlocked?"Débloquer le chat":"Bloquer le chat"}>{player.chatBlocked?"Débloquer":"Bloquer"}</button>
                      <button type="button" className="regie-member-remove" disabled={!!removing||finaleStarted||gameId==="loading"} onClick={()=>void removeMember(player)}>{removing===uid?"Retrait…":"Retirer"}</button>
                    </div>
                  </div>
                ))}
                {!members.length&&<p className="regie-muted">Aucun joueur inscrit dans ce groupe.</p>}
              </div>}
            </div>;
          })}
        </div>
        {!groups.length&&<p className="regie-muted">Aucun groupe créé.</p>}
      </section>}
      {votesExpanded && <section className="regie-expand"><h3>SUIVI DES VOTES · TOUR {tour}</h3><div className="regie-player-grid">{playerEntries.map(([pseudo,player])=><div key={pseudo} className={"regie-player-status "+(playerHasVoted(player)?"yes":"no")}><span>{player.pseudo} · {player.groupName}</span><b>{playerHasVoted(player)?"✓ VOTÉ":"✕ PAS VOTÉ"}</b></div>)}</div>{totalPlayers===0&&<p>Aucun joueur enregistré.</p>}</section>}
      {rankExpanded && <section className="regie-expand"><h3>CLASSEMENT DES JOUEURS</h3><div className="regie-standing-list">{standings.map((p,i)=><div key={p.uid}><strong>{i===0?"👑":String(i+1).padStart(2,"0")}</strong><span>{p.pseudo}</span><b>{p.points} pts</b></div>)}</div>{!standings.length&&<p>Aucun score pour le moment.</p>}</section>}

      <section className="regie-controls"><h2>COMMANDES DE LA RÉGIE</h2><div className="regie-control-grid">
        <button type="button" className={"regie-switch "+(connectionsOpen?"is-on":"is-off")} disabled={controlBusy||gameId==="loading"} onClick={()=>void toggleControl("connections",!connectionsOpen)}><span>⇥</span><b>CONNEXIONS</b><strong>{connectionsOpen?"ON":"OFF"}</strong></button>
        <button type="button" className={"regie-switch "+(votesOpen?"is-on":"is-off")} disabled={controlBusy||finaleStarted||gameId==="loading"} onClick={()=>void toggleControl("votes",!votesOpen)}><span>✉</span><b>VOTES</b><strong>{votesOpen?"ON":"OFF"}</strong></button>
        <button type="button" disabled={!demoLoaded} className={"regie-switch "+(demoEnabled?"is-on":"is-off")} onClick={()=>safely(()=>updateDemoEnabled(!demoEnabled))}><span>▣</span><b>MODE DÉMO</b><strong>{!demoLoaded?"…":demoEnabled?"ON":"OFF"}</strong></button>
        <button type="button" className="regie-show" disabled={publishing||votesOpen||finaleStarted||!finalRankingValidated} onClick={()=>void launchShow()}><span>♛</span><b>SHOW FINAL</b><strong>{finaleStarted?"SHOW LANCÉ":publishing?"PUBLICATION…":"LANCER LE SHOW"}</strong></button>
      </div></section>

      <section className="regie-panel" style={{margin:"18px 0"}}>
        <h3>Chat des salles</h3>
        <label style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:10}}>Choisir la salle <select aria-label="Choisir la salle" value={chatGroup} onChange={e=>setChatGroup(e.target.value)}><option value="">Sélectionner…</option>{chatRooms.map(([id,name])=><option key={id} value={id}>{chatSummary[id]?.alerts>0?"🔴 ":""}{name}{unreadFor(id)>0?" · "+unreadFor(id)+" nouveau(x)":""}{chatSummary[id]?.alerts>0?" · "+chatSummary[id].alerts+" alerte(s)":""}</option>)}</select></label>
        {alertRooms.length>0&&<div className="regie-chat-alerts">{alertRooms.map(g=><button type="button" key={g.id} className="regie-chat-alert-button" onClick={()=>setChatGroup(g.id)}>⚠ {g.name} · {chatSummary[g.id].alerts} alerte{chatSummary[g.id].alerts>1?"s":""}</button>)}</div>}
        {chatGroup&&chatRooms.some(([id])=>id===chatGroup)&&<ChatBubble key={chatGroup} inline user={user} groupRequest={chatRequest} roomId={chatGroup} onRead={chatRead} onReportChange={refreshReports} groupName={chatRooms.find(([id])=>id===chatGroup)?.[1]}/>}
      </section>

      <details className="regie-danger" open={showDangerZone} onToggle={event=>setShowDangerZone(event.currentTarget.open)}>
        <summary>⚠️ Zone sensible — Réinitialisation</summary>
        <div style={{display:"grid",gap:12,marginTop:12}}>
          <div style={{border:"1px solid #dd9b48",borderRadius:12,padding:12,background:"rgba(172,106,28,.12)"}}>
            <button type="button" disabled={resetBusy} style={{width:"100%",background:"#986020",border:"1px solid #ffc87e",color:"#fff",fontWeight:800}} onClick={()=>{setResetKind("game");setResetConfirmation("");setResetFeedback("");}}>Remettre le jeu à zéro</button>
            <p>Efface les votes, coups de cœur, sélections officielles et résultats. Retour au premier tour, votes fermés.</p>
            <p style={{color:"#8fffc1"}}>✓ Conserve les joueurs, les groupes, les invitations et le chat.</p>
          </div>
          <div style={{border:"1px solid #f26c77",borderRadius:12,padding:12,background:"rgba(160,40,65,.14)"}}>
            <button type="button" disabled={resetBusy||votesOpen||finaleStarted||tour!==1} style={{width:"100%",background:"#a42b43",border:"1px solid #ff8793",color:"#fff",fontWeight:800}} onClick={()=>{setResetKind("registrations");setResetConfirmation("");setResetFeedback("");}}>Remettre les inscriptions à zéro</button>
            <p>Supprime les joueurs inscrits, groupes, invitations et chats. Ferme les connexions publiques.</p>
            <p style={{color:"#8fffc1"}}>✓ Conserve le compte administrateur et les paramètres du concours.</p>
            <small>Si la partie a commencé, remets d’abord le jeu à zéro.</small>
          </div>
          {resetKind&&<div style={{border:"2px solid #ff8793",borderRadius:12,padding:12,display:"grid",gap:10}}>
            <strong>Attention : {resetKind==="game"?"réinitialisation du jeu":"suppression des inscriptions"}</strong>
            <label htmlFor="reset-confirm">Écris <strong>{resetWord}</strong> pour confirmer :</label>
            <input id="reset-confirm" value={resetConfirmation} onChange={event=>setResetConfirmation(event.target.value)} autoComplete="off" autoCapitalize="characters" disabled={resetBusy}/>
            <button type="button" disabled={resetBusy||resetConfirmation!==resetWord} onClick={confirmReset}>{resetBusy?"Réinitialisation en cours…":"Confirmer définitivement"}</button>
            <button type="button" disabled={resetBusy} onClick={()=>{setResetKind("");setResetConfirmation("");}}>Annuler</button>
          </div>}
          {resetFeedback&&<p role="status" style={{color:resetFeedback.startsWith("Attention")?"#ffb3b3":"#8fffc1"}}>{resetFeedback}</p>}
        </div>
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
          disabled={savingFinalRanking || advancingTour || finalRankingValidated || (tour < 3 && votesOpen)}
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
            : (advancingTour ? "Passage au tour suivant…" : votesOpen ? "⛔ Fermez les votes pour valider" : "Valider la sélection")}
        </button>
        {tour < 3 && votesOpen && <p role="status" style={{color:"#ffd48a",fontWeight:700,marginTop:10}}>Ferme d'abord les votes dans les commandes de la régie pour passer au tour suivant.</p>}
        {tour === 3 && !finalRankingValidated && <p role="status" style={{color:"#ffd48a",fontWeight:700,marginTop:10}}>Le show final reste verrouillé tant que le classement officiel n'est pas validé.</p>}
      </div>


    </div>
  );
}
