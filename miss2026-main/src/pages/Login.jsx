import React, { useContext, useState, useEffect, useRef } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth, simulatedPlayerApp } from "../firebase";
import {TEST_ORIGIN,testPlayerUrl,adminSessionUrl} from "../testPlayerSession.mjs";
import ChatBubble from "../components/ChatBubble";
import RulesToggle from "../components/RulesToggle";
import InvitationPreview from "../components/InvitationPreview";
import InvitationCard from "../components/InvitationCard";
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
 
// 12 décembre 2026, 20 h 40 à Paris (heure d'hiver : UTC+1).
const REGISTRATION_OPEN_AT = new Date("2026-12-12T20:40:00+01:00").getTime();
function getRemainingTime() {
  const total = Math.max(0, Math.ceil((REGISTRATION_OPEN_AT - Date.now()) / 1000));
  return {
    total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}


const GROUP_API="https://miss2027-test-api.onrender.com";
const groupErrors={player_removed:"La régie a retiré ton inscription du concours.",recovery_invalid:"Pseudo ou mot de passe du groupe incorrect.",creation_not_verified:"La création du groupe n’a pas pu être confirmée. Réessaie de retrouver ton groupe.",group_name_taken:"Nom du groupe déjà pris. Choisis-en un autre.",group_full:"Ce groupe est complet (30 participants maximum).",pseudo_taken:"Pseudo déjà pris. Choisis-en un autre.",membership_locked:"Le concours a commencé : les groupes sont figés.",invalid_member:"Ce participant ne peut pas être retiré.",not_registered:"Ton inscription est introuvable. Retourne à l’accueil.",game_unavailable:"Le concours n’est pas encore initialisé.",game_finished:"Le concours est terminé.",public_closed:"Les connexions sont fermées par la régie. Patiente dans ton groupe.",admin_cannot_register:"Utilise une autre session pour jouer : ce compte est réservé à la régie.",registration_reset:"Les inscriptions viennent d’être réinitialisées. Recommence.",owner_required:"Seul le créateur reconnu sur son navigateur peut gérer ce groupe.",already_member:"Tu appartiens déjà à un groupe.",group_or_password_invalid:"Groupe indisponible ou mot de passe incorrect.",invalid_password:"Mot de passe incorrect.",invitation_changed:"Ce lien a été remplacé ou désactivé. Prépare un nouveau lien.",invitation_unavailable:"Invitation temporairement indisponible. Contacte la régie.",unavailable:"Les inscriptions à ce groupe sont fermées.",too_many_requests:"Trop de tentatives. Réessaie dans une minute.",test_registration_disabled:"Le serveur d’inscription est en cours de préparation.",invalid_token:"Ta session a expiré. Actualise la page.",invalid_fields:"Vérifie le pseudo et le mot de passe."};
const lobbyChat=body=>groupRequest("/chat",body);
async function groupRequest(path,body) {
  if(window.location.origin!=="https://miss2027-test.onrender.com")throw Error("Ce service est réservé au site test.");
  const user=auth.currentUser;
  if(!user)throw Error("Connexion en cours. Réessaie dans quelques instants.");
  const token=await user.getIdToken();
  const response=await fetch(GROUP_API+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000),cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(groupErrors[data.error]||"Le serveur n’a pas pu terminer l’opération ("+response.status+")."),{code:data.error});
  if(auth.currentUser?.uid!==user.uid)throw Error("La session a changé. Recommence l’opération.");
  return data;
}

export default function Login({ setUser }) {
  const { connectionsOpen, connectionsLoaded, connectionsError, demoEnabled, demoLoaded, gameId } = useContext(AppContext);
  const [showRules, setShowRules] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [entryMode, setEntryMode] = useState("home");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupResults, setGroupResults] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupPassword, setGroupPassword] = useState("");
  const [joinedGroup, setJoinedGroup] = useState(null);
  const [recoveryInput,setRecoveryInput]=useState("");
  const [recoveryPseudo,setRecoveryPseudo]=useState("");
  const [lobbyMembers,setLobbyMembers]=useState([]);
  const [lobbyError,setLobbyError]=useState("");
  const restoredIdentity=useRef(null);
  const [firebaseIdentity,setFirebaseIdentity]=useState(null);
  const [recoverableGroup,setRecoverableGroup]=useState(null);
  const [recoveryStatus,setRecoveryStatus]=useState("idle");
  const [creatorName, setCreatorName] = useState("");
  const [creatorPseudo, setCreatorPseudo] = useState("");
  const [creatorPassword,setCreatorPassword]=useState("");
  const [ownerGroup,setOwnerGroup]=useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const invitation = searchParams.get("invite");
  const [inviteGroup,setInviteGroup]=useState(null);
  const [invitationPassword,setInvitationPassword]=useState("");
  const [inviteForm,setInviteForm]=useState(false);
  const [inviteLink,setInviteLink]=useState("");
  const [showInvitation,setShowInvitation]=useState(false);
  const [showParticipants,setShowParticipants]=useState(false);
  useEffect(()=>{setShowParticipants(false);},[firebaseIdentity,ownerGroup?.id,entryMode]);
  useEffect(()=>{setShowInvitation(false);setInviteLink("");},[firebaseIdentity,ownerGroup?.id]);
  const [inviteStatus,setInviteStatus]=useState("");
  const screen = invitation ? "invite" : entryMode;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const activePseudo=screen==="create-group"?creatorPseudo:["public","invite","join-group"].includes(screen)?pseudo:"";
  const pseudoKey=activePseudo.trim()?JSON.stringify([firebaseIdentity,gameId,activePseudo.trim(),screen==="create-group"]):"";
  const [pseudoCheck,setPseudoCheck]=useState({key:"",status:""});
  const [pseudoRetry,setPseudoRetry]=useState(0);
  const pseudoStatus=!pseudoKey?"":pseudoCheck.key===pseudoKey?pseudoCheck.status:"checking";
  const pseudoReady=pseudoStatus==="available";
  useEffect(()=>{
    if(!pseudoKey||!firebaseIdentity)return;
    let active=true;
    setPseudoCheck({key:pseudoKey,status:"checking"});
    const timer=setTimeout(async()=>{
      try{
        const result=await groupRequest("/groups/pseudo",{pseudo:activePseudo.trim(),creating:screen==="create-group"});
        if(active)setPseudoCheck({key:pseudoKey,status:result.available===true?"available":"taken"});
      }catch{if(active)setPseudoCheck({key:pseudoKey,status:"error"});}
    },750);
    return()=>{active=false;clearTimeout(timer);};
  },[pseudoKey,pseudoRetry,firebaseIdentity]);
  const pseudoFeedback=()=>!pseudoStatus?null:<div aria-live="polite" style={{fontSize:13,fontWeight:600,color:pseudoStatus==="available"?"#78ffbd":pseudoStatus==="taken"||pseudoStatus==="error"?"#ff929a":"#c6d3ee"}}>{pseudoStatus==="available"?"✓ Pseudo disponible":pseudoStatus==="taken"?"✗ Pseudo déjà pris":pseudoStatus==="error"?<>Vérification indisponible. <button type="button" onClick={()=>setPseudoRetry(n=>n+1)} style={{fontSize:12,padding:"3px 8px"}}>Réessayer</button></>:"Vérification du pseudo…"}</div>;
  const nameKey=screen==="create-group"&&creatorName.trim()?JSON.stringify([firebaseIdentity,gameId,creatorName.trim()]):"";
  const [nameCheck,setNameCheck]=useState({key:"",status:""});
  const [nameRetry,setNameRetry]=useState(0);
  const nameStatus=!nameKey?"":nameCheck.key===nameKey?nameCheck.status:"checking";
  const nameReady=nameStatus==="available";
  useEffect(()=>{
    if(!nameKey||!firebaseIdentity)return;
    let active=true;
    setNameCheck({key:nameKey,status:"checking"});
    const timer=setTimeout(async()=>{
      try{
        const result=await groupRequest("/groups/name",{name:creatorName.trim()});
        if(active)setNameCheck({key:nameKey,status:result.available===true?"available":"taken"});
      }catch{if(active)setNameCheck({key:nameKey,status:"error"});}
    },750);
    return()=>{active=false;clearTimeout(timer);};
  },[nameKey,nameRetry,firebaseIdentity]);
  const nameFeedback=()=>!nameStatus?null:<div aria-live="polite" style={{fontSize:13,fontWeight:600,color:nameStatus==="available"?"#78ffbd":nameStatus==="taken"||nameStatus==="error"?"#ff929a":"#c6d3ee"}}>{nameStatus==="available"?"✓ Nom du groupe disponible":nameStatus==="taken"?"✗ Nom du groupe déjà pris":nameStatus==="error"?<>Vérification indisponible. <button type="button" onClick={()=>setNameRetry(n=>n+1)} style={{fontSize:12,padding:"3px 8px"}}>Réessayer</button></>:"Vérification du nom du groupe…"}</div>;
  const [remaining, setRemaining] = useState(getRemainingTime);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const navigate = useNavigate();
  useEffect(()=>{try{localStorage.removeItem("miss2027_test_creator_email_draft");}catch{}},[]);

  // Authenticate first-time visitors before reading the admin-controlled entry flag.
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if(!active)return;
      setFirebaseIdentity(firebaseUser?.uid||null);
      if(firebaseUser&&firebaseUser.uid!==import.meta.env.VITE_ADMIN_UID){
        // Preserve the existing identity, including users upgraded from tab-only storage.
        setPersistence(auth,browserLocalPersistence).catch(()=>{});
      }else if (!firebaseUser) {
        (async()=>{
          try{
            try{await setPersistence(auth,browserLocalPersistence);}catch{}
            if(active&&!auth.currentUser)await signInAnonymously(auth);
          }catch(error){
            if(active)setError("Connexion au serveur impossible : "+(error?.code||error?.message));
          }
        })();
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const searchGeneration=useRef(0);
  useEffect(()=>{searchGeneration.current++;setGroupResults(null);setSelectedGroup(null);},[gameId]);
  useEffect(()=>{
    if(!firebaseIdentity||firebaseIdentity===import.meta.env.VITE_ADMIN_UID||invitation||restoredIdentity.current===firebaseIdentity)return;
    let active=true;
    groupRequest("/groups/me").then(async result=>{
      if(!active)return;
      if(result.removed){restoredIdentity.current=firebaseIdentity;setError("La régie a retiré ton inscription du concours.");return;}
      if(!result.group){restoredIdentity.current=firebaseIdentity;return;}
      if(result.group.isOwner){
        const owner=await groupRequest("/groups/owner/manage");
        if(active){restoredIdentity.current=firebaseIdentity;setOwnerGroup(owner.group);setEntryMode("creator-dashboard");}
      }else{restoredIdentity.current=firebaseIdentity;setJoinedGroup(result.group);setEntryMode("joined-group");}
    }).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[firebaseIdentity,invitation]);
  const lobbyGroup=screen==="joined-group"?joinedGroup:["creator-confirm","creator-dashboard"].includes(screen)?ownerGroup:null;
  useEffect(()=>{
    if(!lobbyGroup?.id)return;
    let active=true,busy=false,missing=0;
    async function poll(){
      if(!active||busy||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const data=await groupRequest("/groups/me");
        if(!active)return;
        if(data.removed){setJoinedGroup(null);setOwnerGroup(null);setEntryMode("home");setError("La régie a retiré ton inscription du concours.");return;}
        if(data.group?.id!==lobbyGroup.id){
          if(++missing<2){setLobbyError("Vérification de ton inscription en cours…");return;}
          setJoinedGroup(null);setOwnerGroup(null);setEntryMode("home");setError("Ton inscription n’est plus active après vérification.");return;
        }
        missing=0;setLobbyMembers(data.members||[]);setLobbyError("");
        if(data.group.isOwner){
          if(!lobbyGroup.isOwner){const owner=await groupRequest("/groups/owner/manage");if(active){setOwnerGroup(owner.group);setEntryMode("creator-dashboard");}}
          else setOwnerGroup(old=>old?.id===data.group.id?{...old,...data.group,members:data.members||old.members}:old);
        }
        else setJoinedGroup(data.group);
      }catch(e){if(active)setLobbyError(e.message);}
      finally{busy=false;}
    }
    void poll();const timer=setInterval(poll,15000);
    window.addEventListener("online",poll);document.addEventListener("visibilitychange",poll);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("online",poll);document.removeEventListener("visibilitychange",poll);};
  },[lobbyGroup?.id,firebaseIdentity]);
  // Recover from Firebase, not a cached group name or a pseudo. Do not redirect
  // automatically: the owner must remain free to manage the group or open the demo.
  useEffect(()=>{
    let active=true;
    if(screen!=="home"||!firebaseIdentity||firebaseIdentity===import.meta.env.VITE_ADMIN_UID)return;
    setRecoverableGroup(null);setRecoveryStatus("loading");
    groupRequest("/groups/me").then(result=>{
      if(active){setRecoverableGroup(result.group||null);setRecoveryStatus("done");}
    }).catch(()=>{if(active)setRecoveryStatus("failed");});
    return()=>{active=false;};
  },[screen,firebaseIdentity,gameId]);
  async function restoreAccount(event){
    event.preventDefault();
    if(pending||!firebaseIdentity)return;
    if(!recoveryPseudo.trim()){setError("Saisis ton pseudo.");return;}
    if(recoveryInput.length<6){setError("Saisis le mot de passe du groupe.");return;}
    setPending(true);setError("");
    try{
      const result=await groupRequest("/groups/recovery/login",{pseudo:recoveryPseudo.trim(),password:recoveryInput});
      if(!result.token||!result.uid)throw Error("Récupération non confirmée.");
      await setPersistence(auth,browserLocalPersistence);
      try{sessionStorage.removeItem("miss_manual_exit");}catch{}
      const credential=await signInWithCustomToken(auth,result.token);
      if(credential.user.uid!==result.uid)throw Error("Identité non confirmée.");
      setRecoveryInput("");
      window.location.hash="/login";
      window.location.reload();
    }catch(e){setError(e.message);}finally{setPending(false);}
  }
  async function recoverGroup(){
    if(pending)return;
    setPending(true);setError("");
    try{
      const result=await groupRequest("/groups/me");
      setRecoverableGroup(result.group||null);setRecoveryStatus("done");
      if(result.group){setJoinedGroup(result.group);setEntryMode("joined-group");}
      else setError("Aucune inscription retrouvée sur cette session.");
    }catch(err){setError(err.message||"Impossible de retrouver ton groupe.");}
    finally{setPending(false);}
  }

  useEffect(()=>{
    let active=true;
    setInviteGroup(null);setInviteStatus("");setInvitationPassword("");setInviteForm(false);
    if(!invitation||!firebaseIdentity)return;
    groupRequest("/groups/invite/preview",{token:invitation}).then(r=>{if(active){setInviteGroup(r.group);setInvitationPassword(typeof r.password==="string"?r.password:"");setInviteStatus("ok");}}).catch(e=>{if(active)setInviteStatus(e.message);});
    return()=>{active=false;};
  },[invitation,firebaseIdentity,gameId]);
  async function acceptInvite(event){
    event.preventDefault();
    if(pending||!inviteGroup||!pseudoReady)return;
    setPending(true);setError("");
    try{const result=await groupRequest("/groups/invite/join",{token:invitation,pseudo:pseudo.trim()});setJoinedGroup(result.group);setEntryMode("joined-group");setSearchParams({}, {replace:true});}
    catch(e){setError(e.message);}finally{setPending(false);}
  }
  async function ownerAction(action,value,targetUid){
    if(pending||!ownerGroup)return;
    setPending(true);setError("");setInviteStatus("");
    try{
      const result=await groupRequest("/groups/owner/manage",{action,value,targetUid});
      setOwnerGroup(result.group);
      if(action==="invite"){
        if(!result.token)throw Error("Le serveur n’a pas renvoyé le lien d’invitation.");
        setInviteLink(window.location.origin+"/#/login?invite="+encodeURIComponent(result.token));
        setInviteStatus("Lien d’invitation prêt ! Appuie sur Partager le lien pour l’envoyer.");
      }
      if(action==="revoke"){setInviteLink("");setShowInvitation(false);}
    }catch(e){setError(e.message);}finally{setPending(false);}
  }
  async function loadInvitation(password){
    const result=await groupRequest("/groups/owner/invitation",password===undefined?undefined:{password});
    if(result.group?.id!==ownerGroup?.id||!result.group?.isOwner)throw Error("Le groupe a changé.");
    setOwnerGroup(result.group);
    if(result.passwordRequired)return {passwordRequired:true};
    if(!/^[a-f0-9]{64}$/.test(result.token||"")||typeof result.password!=="string")throw Error("Invitation non confirmée.");
    return {password:result.password,link:window.location.origin+"/#/login?invite="+encodeURIComponent(result.token)};
  }
  async function refreshOwner(){
    if(pending)return;
    setPending(true);setError("");
    try{const result=await groupRequest("/groups/owner/manage");setOwnerGroup(result.group);}catch(e){setError(e.message);}finally{setPending(false);}
  }

  // No fallback to legacy pseudo-based entry before V2 group assignment exists.
  function openEntry(mode) {
    setError(""); setEntryMode(mode);
  }
  function backToHome() {
    setError(""); setEntryMode("home");
    setGroupQuery(""); setGroupResults(null); setSelectedGroup(null); setGroupPassword("");
    setCreatorPassword("");setInviteLink("");setInviteStatus("");setRecoveryInput("");
    if (invitation) setSearchParams({}, {replace:true});
  }
  async function searchRealGroups(event) {
    event.preventDefault();
    if(pending||!groupQuery.trim())return;
    setPending(true);setError("");setGroupResults(null);
    const generation=searchGeneration.current;
    try{
      const membership=await groupRequest("/groups/me");
      if(generation!==searchGeneration.current)return;
      if(membership.group){setJoinedGroup(membership.group);setEntryMode("joined-group");return;}
      const result=await groupRequest("/groups/search?q="+encodeURIComponent(groupQuery.trim()));
      if(generation===searchGeneration.current)setGroupResults(result.groups);
    }catch(err){setError(err.message||"Recherche impossible.");}
    finally{setPending(false);}
  }
  function selectPreviewGroup(group) {
    setSelectedGroup(group); setGroupPassword(""); setPseudo(""); setError(""); setEntryMode("join-group");
  }
  async function submitRealGroup(event) {
    event.preventDefault();
    if(pending||!selectedGroup||!pseudoReady||groupPassword.length<6)return;
    setPending(true);setError("");
    try{
      const result=await groupRequest("/groups/join",{id:selectedGroup.id,pseudo:pseudo.trim(),password:groupPassword});
      
      setJoinedGroup(result.group||{id:result.id,name:result.name,pseudo:pseudo.trim(),isOwner:false});
      setEntryMode("joined-group");
    }catch(err){setError(err.message||"Inscription impossible.");}
    finally{setGroupPassword("");setPending(false);}
  }
  function showExistingMembership(group){
    setJoinedGroup(group);setCreatorPassword("");setInviteLink("");setEntryMode("joined-group");
    setError("Tu appartiens déjà à un groupe. Tu ne peux pas en créer un deuxième.");
  }
  async function createRealGroup(event){
    event.preventDefault();
    if(pending||!firebaseIdentity||!nameReady||!pseudoReady||creatorPassword.length<6)return;
    setPending(true);setError("");
    try{
      const result=await groupRequest("/groups/create",{name:creatorName.trim(),pseudo:creatorPseudo.trim(),password:creatorPassword});
      if(!result.group?.isOwner||result.group.id!==result.id)throw Error("Création non confirmée par le serveur. Essaie de retrouver ton groupe.");
      
      restoredIdentity.current=firebaseIdentity;
      setOwnerGroup(result.group);
      setEntryMode("creator-confirm");
    }catch(err){
      if(err.code==="already_member"){
        try{const membership=await groupRequest("/groups/me");if(membership.group){showExistingMembership(membership.group);return;}}catch{}
      }
      setError(err.message||"Création impossible.");
    }finally{setCreatorPassword("");setPending(false);}
  }
  async function startCreatorFlow(mode){
    if(pending)return;
    setError("");setPending(true);
    try{
      const membership=await groupRequest("/groups/me");
      if(mode==="creator-login"||membership.group?.isOwner){
        if(!membership.group?.isOwner){
          setError("Aucun groupe à gérer sur ce navigateur. Seul son créateur peut y accéder.");
          return;
        }
        const result=await groupRequest("/groups/owner/manage");
        setOwnerGroup(result.group);setInviteLink("");setInviteStatus("");setEntryMode("creator-dashboard");return;
      }
      if(membership.group){showExistingMembership(membership.group);return;}
      setCreatorName("");setCreatorPseudo("");setCreatorPassword("");setOwnerGroup(null);setInviteLink("");setInviteStatus("");openEntry(mode);
    }catch(err){setError(err.message||"Impossible de vérifier ton inscription.");}
    finally{setPending(false);}
  }
  async function registerPublicPlayer(event) {
    event.preventDefault();
    if(pending||!pseudoReady||!connectionsLoaded||!connectionsOpen||connectionsError)return;
    setPending(true);setError("");
    try {
      const result=await groupRequest("/groups/public",{pseudo:pseudo.trim()});
      if(!result.group?.id||!result.group?.name)throw Error("Inscription non confirmée. Réessaie.");
      
      setJoinedGroup(result.group);
      setEntryMode("joined-group");
    }catch(err){setError(err.message||"Inscription impossible.");}
    finally{setPending(false);}
  }
  async function enterContest(event){
    event.preventDefault();
    if(pending||lobbyError)return;
    setPending(true);setError("");
    try{
      const result=await groupRequest("/game/enter",{});
      const uid=auth.currentUser?.uid;
      if(!uid||!result.group?.id||!result.gameId)throw Error("Entrée dans le concours non confirmée.");
      try{sessionStorage.removeItem("miss_manual_exit");}catch{}
      setUser({role:"player",uid,pseudo:result.group.pseudo,groupId:result.group.id,groupName:result.group.name,gameId:result.gameId});
      navigate("/player",{replace:true});
    }catch(err){setError(err.message||"Accès impossible.");}
    finally{setPending(false);}
  }
  const entryButton = {
    width:"100%", minHeight:52, boxSizing:"border-box", borderRadius:13,
    padding:"13px 12px", color:"white", fontSize:16, fontWeight:800, lineHeight:1.35, cursor:"pointer",
    background:"linear-gradient(110deg,#143b87,#2862bb)", border:"1px solid #64a9ea",
    boxShadow:"0 0 12px rgba(39,131,255,.25)"
  };
  const greenButton = {
    ...entryButton, background:"linear-gradient(110deg,#003b26,#006f42,#009e63)",
    border:"2px solid #15ef98", boxShadow:"0 0 9px #00e58a,0 0 20px rgba(0,235,137,.35)"
  };
  const inputStyle = {
    width:"100%",minHeight:48,padding:"12px",boxSizing:"border-box",
    border:"1px solid #6a82bb",borderRadius:12,fontSize:16
  };
  const notice = message => <p role="status" style={{margin:0,color:"#e0e8ff",fontSize:14,lineHeight:1.5}}>{message}</p>;
  const canEnter = connectionsLoaded && connectionsOpen && !connectionsError;
  function accessControl(isPublic, action, disabled=false, resume=false) {
    const label = isPublic ? "Rejoindre un groupe public" : "Accéder au concours";
    if (canEnter || (resume && connectionsLoaded && !connectionsError)) return <button type="button" className="group-entry-green" onClick={action} disabled={disabled || pending}
      style={{...greenButton,opacity:disabled || pending ? .55 : 1}}>{label}</button>;
    return <button type="button" className="group-entry-green group-entry-countdown" disabled
      aria-label={connectionsError ? "Impossible de vérifier les connexions" : !connectionsLoaded ? "Connexion au serveur en cours" : remaining.total > 0 ? label + " dans " + remaining.days + " jours, " + remaining.hours + " heures, " + remaining.minutes + " minutes et " + remaining.seconds + " secondes" : "En attente de l’administrateur"}>
      {connectionsError ? "⚠️ Impossible de vérifier les connexions"
        : !connectionsLoaded ? "⏳ Connexion au serveur en cours…"
        : remaining.total > 0 ? <>
          <span className="group-entry-countdown-label">{label} dans :</span>
          <span className="group-entry-clock" aria-hidden="true">
            {[["j",remaining.days],["h",remaining.hours],["min",remaining.minutes],["s",remaining.seconds]].map(([unit,value]) => (
              <span key={unit} className="group-entry-clock-part">
                <span className="group-entry-clock-number">{String(value).padStart(2,"0")}</span>
                <span className="group-entry-clock-unit">{unit}</span>
              </span>
            ))}
          </span>
        </> : <>
          <span className="group-entry-countdown-label">{label}</span>
          <span className="group-entry-clock-wait">En attente de l’administrateur</span>
        </>}
    </button>;
  }

  function openTestPlayer(){
    const url=testPlayerUrl(window.location.href,crypto.randomUUID());
    if(url)window.open(url,"_blank","noopener,noreferrer");
  }

  return (
    <div className="tv-login-shell tv-show-v3"><div className="tv-entry-stage" aria-hidden="true"><img className="tv-stage-crown" src="/images/couronne-prestige.svg" alt="" aria-hidden="true" style={{ width: "clamp(130px, 32vw, 195px)", height: "auto", objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(238,190,107,.35))" }} /></div>
      <header className="tv-hero" style={{ position: "relative", overflow: "hidden", padding: "34px 15px 30px", margin: "-12px -15px 24px", borderRadius: 22, background: "radial-gradient(ellipse at 50% -20%, rgba(248,205,132,.28), transparent 65%), linear-gradient(145deg,#18121b 0%,#0b0c14 100%)", border: "1px solid rgba(232,192,123,.45)", boxShadow: "0 14px 36px rgba(0,0,0,.24)", color: "#fff7e8" }}>
        <img src="/images/couronne-prestige.svg" alt="" aria-hidden="true" style={{ display: "block", width: 108, height: 73, objectFit: "contain", margin: "0 auto 12px", filter: "drop-shadow(0 0 5px rgba(240,198,119,.28))" }} />
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(34px, 9vw, 49px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-.02em", margin: "14px 0 0", color: "#f9e4be", textShadow: "0 2px 22px rgba(238,187,100,.25)" }}>MISS FRANCE <span style={{ display: "block", fontSize: "1.25em", letterSpacing: ".05em" }}>2027</span></h1>
        <div style={{ width: 76, height: 1, margin: "20px auto", background: "linear-gradient(90deg,transparent,#e9c487,transparent)" }} />
        <p style={{ margin: "0 auto", maxWidth: 330, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "clamp(21px, 5.5vw, 27px)", lineHeight: 1.35, color: "#fff9ee" }}>Qui aura le <span style={{ color: "#f2c784" }}>meilleur pronostic ?</span></p>
      </header>
      <div style={{width:"min(100%,600px)",margin:"0 auto 16px"}}>
        <RulesToggle open={showRules} controls="howto-rules" onToggle={()=>setShowRules(open=>!open)}>Comment jouer ?</RulesToggle>
        <div id="howto-rules" hidden={!showRules}>
      <section className="tv-howto tv-howto-v3" aria-label="Comment jouer" style={{ background: "linear-gradient(160deg, #231131, #18112d)", border: "1px solid #bc79be", color: "white", borderRadius: 22, padding: "18px 12px", marginBottom: 0, marginTop: 10, boxShadow: "0 10px 28px rgba(37,12,56,.23)" }}>
        <div style={{textAlign:"left",padding:"12px",marginBottom:14,borderRadius:14,background:"rgba(148,92,205,.17)",border:"1px solid #bc79be",fontSize:15,lineHeight:1.5}}>
          <div style={{fontWeight:800,color:"#f7acd7",marginBottom:8,textAlign:"center"}}>Deux façons de jouer :</div>
          <div style={{marginBottom:8}}>🌍 <strong>En salle publique :</strong> joue seul en rejoignant d’autres participants que tu ne connais pas.</div>
          <div>👥 <strong>En groupe privé :</strong> un organisateur crée son groupe et invite ses amis ou sa famille à le rejoindre pour jouer ensemble.</div>
        </div>
        {[
          { n: "01", text: "Premier tour : sélectionner 12 Miss et votre coup de cœur.", background: "#83283F", border: "#E66C8B", accent: "#FFD8E0" },
          { n: "02", text: "Deuxième tour : sélectionner 5 Miss.", background: "#205C99", border: "#64A9EA", accent: "#DAEEFF" },
          { n: "03", text: "Troisième tour : classer les 5 finalistes.", background: "#14755E", border: "#51C8A4", accent: "#DCFFF0" }
        ].map(item => (
          <div key={item.n} style={{ display: "flex", alignItems: "center", textAlign: "left", gap: 12, padding: 12, marginBottom: 10, background: item.background, border: `1px solid ${item.border}`, borderRadius: 14 }}>
            <span style={{ flexShrink: 0, width: 43, height: 43, borderRadius: 10, background: "rgba(255,255,255,.12)", color: item.accent, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800 }}>{item.n}</span>
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
        <div style={{textAlign:"center",padding:"17px 12px",margin:"12px 0",borderRadius:14,border:"1px solid #d6aa65",background:"linear-gradient(135deg,#493054,#261b38)",color:"#ffe6b3"}}>
          <div style={{fontSize:24}}>👑</div><strong style={{fontSize:19,letterSpacing:".04em"}}>LE SHOW FINAL</strong>
          <p style={{fontSize:14,lineHeight:1.5,margin:"6px 0 0"}}>Découvre ton classement juste après l’élection de Miss France !</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,textAlign:"left",borderTop:"1px solid #755581",padding:"12px 4px 2px",color:"#f4d6ee",fontSize:14,lineHeight:1.5}}><span style={{fontSize:23}}>⏳</span><span>À chaque tour, attends l’ouverture des votes pour valider tes choix.</span></div>
      </section>
        </div>
      </div>
      {screen==="join"&&<div style={{width:"min(100%,600px)",margin:"0 auto 16px"}}>
        <button type="button" disabled={pending} onClick={()=>{setError("");setEntryMode("recover-account");}} style={{...entryButton,display:"block",minHeight:74,fontSize:18,margin:0,border:"2px solid #80caff",boxShadow:"0 0 7px rgba(82,173,255,.85),0 0 19px rgba(39,131,255,.6),0 0 30px rgba(39,131,255,.23)"}}>Se connecter à son compte</button>
      </div>}
      <div className="tv-entry tv-entry-v3 group-entry-panel" style={{display:"grid",gap:12}}>
        <style>{`
          .tv-login-shell .group-entry-panel button { margin-top:0; }
          .tv-login-shell .group-entry-panel button.group-entry-blue {
            background:linear-gradient(110deg,#143b87,#2862bb)!important;
            color:#fff!important;border:1px solid #64a9ea!important;
            box-shadow:0 0 12px rgba(39,131,255,.25)!important;font-size:16px;
          }
          .tv-login-shell .group-entry-panel button.group-entry-neon {
            border:2px solid #80caff!important;
            box-shadow:0 0 7px rgba(82,173,255,.85),0 0 19px rgba(39,131,255,.6),0 0 30px rgba(39,131,255,.23)!important;font-size:16px;
          }
          /* Explicit styles override the older first-of-type gold rule. */
          .tv-login-shell .group-entry-panel button.group-entry-invite {
            background:linear-gradient(110deg,#b94b24 0%,#c52c68 48%,#8136bd 100%)!important;
            border:2px solid #ff9acf!important;color:#fff!important;
            box-shadow:0 0 9px rgba(255,115,181,.8),0 0 22px rgba(229,54,147,.38)!important;
            font-size:16px;
          }
          .tv-login-shell .group-entry-panel button.group-entry-participants {
            background:linear-gradient(110deg,#142650,#203e75)!important;
            color:#ffe5ad!important;border:0!important;box-shadow:none!important;
            font-size:17px;
          }
          .tv-login-shell .group-entry-panel button.group-entry-green {
            background:linear-gradient(135deg,#008743,#00c96b,#00a854)!important;
            color:#fff!important;border:2px solid #46ff9b!important;
            box-shadow:0 0 9px #00e58a,0 0 20px rgba(0,235,137,.35)!important;font-size:16px;
          }
          .tv-login-shell .group-entry-panel button.group-entry-countdown:disabled {
            opacity:1!important;cursor:not-allowed;
            min-height:90px;padding:15px 8px!important;
            box-sizing:border-box;display:grid;gap:10px;align-content:center;
            text-align:center;line-height:1.35;
          }
          .group-entry-countdown-label { display:block;color:#fff;font-size:16px;font-weight:800; }
          .group-entry-clock {
            display:flex;justify-content:center;align-items:baseline;gap:clamp(5px,2vw,13px);
            white-space:nowrap;font-variant-numeric:tabular-nums;color:#ff2020;
            text-shadow:0 1px 2px #002b17,0 0 1px #002b17;
          }
          .group-entry-clock-part {display:inline-flex;gap:2px;align-items:baseline;}
          .group-entry-clock-number {font-size:clamp(21px,6.4vw,30px);font-weight:900;line-height:1.1;}
          .group-entry-clock-unit {font-size:clamp(12px,3.5vw,16px);font-weight:800;}
          .group-entry-clock-wait {font-size:13px;color:#fff;}
          .tv-login-shell .group-entry-panel button.group-entry-danger {
            background:linear-gradient(135deg,#73263d,#a5394e)!important;
            color:#fff!important;border:1px solid #e4778d!important;
            box-shadow:none!important;font-size:13px;font-weight:700;
          }
          .tv-login-shell .group-entry-panel button.group-entry-remove {
            background:linear-gradient(135deg,#7b233e,#a8334c)!important;
            color:#fff!important;border:1px solid #ff859c!important;
            box-shadow:0 0 9px rgba(255,85,117,.25)!important;
            flex:0 0 auto!important;width:auto!important;min-width:0!important;min-height:32px!important;padding:7px 12px!important;font-size:12px!important;line-height:1.2!important;border-radius:8px!important;
          }
          .tv-login-shell .group-entry-panel button.group-entry-back {
            background:transparent!important;color:#c6d3ee!important;
            border:0!important;box-shadow:none!important;font-size:14px;
          }
        `}</style>
        {screen === "home" && <>
          {accessControl(true, () => openEntry("public"))}
          <button type="button" className="group-entry-blue group-entry-neon" style={entryButton} disabled={pending} onClick={() => openEntry("join")}>Rejoindre mon groupe d’amis ou de famille</button>
          <button type="button" className="group-entry-gold" style={{...entryButton,background:"linear-gradient(135deg,#d9a42d,#ffe078,#e8b63e)",color:"#342303",border:"2px solid #ffdf77",boxShadow:"0 0 12px rgba(255,204,70,.42)"}} onClick={() => openEntry("manage")}>Créer / Gérer son groupe</button>
        </>}
        {(screen === "public" || screen === "invite") && <>
          {screen==="invite"&&inviteGroup&&<InvitationCard name={inviteGroup.name} password={invitationPassword} onJoin={()=>setInviteForm(true)}/>}
          {(screen==="public"||inviteForm)&&<>
            <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} disabled={pending} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
            {pseudoFeedback()}
            {screen === "public" && notice("Tu seras automatiquement inscrit dans une salle publique de 30 joueurs maximum. Si tu appartiens déjà à un groupe, tu retrouveras ton groupe actuel.")}
            {screen==="public"?accessControl(true,registerPublicPlayer,!pseudoReady):<button type="button" className="group-entry-green" style={greenButton} disabled={pending||!inviteGroup||!pseudoReady} onClick={acceptInvite}>Rejoindre le groupe</button>}
          </>}
          {pending && notice("Inscription en cours…")}
          {screen === "invite" && notice(inviteStatus==="ok"?"Invitation vérifiée. Aucun mot de passe à saisir.":inviteStatus||"Vérification de l’invitation…")}
        </>}
        {screen === "join" && <>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:20,textAlign:"center"}}>Créer mon groupe</h2>
          <form onSubmit={searchRealGroups} style={{display:"grid",gap:12}}>
            <input aria-label="Nom du groupe" placeholder="Nom du groupe" maxLength={80} value={groupQuery} disabled={pending} onChange={e => {setGroupQuery(e.target.value);setGroupResults(null);setError("");}} style={inputStyle}/>
            <button type="submit" className="group-entry-blue" style={entryButton} disabled={pending||!groupQuery.trim()}>{pending?"Recherche en cours…":"Rechercher"}</button>
          </form>
          {groupResults !== null && <div aria-live="polite" style={{display:"grid",gap:10,textAlign:"left"}}>
            <p style={{fontSize:12,color:"#ffd49c",margin:"4px 0"}}>Groupes enregistrés dans Firebase test</p>
            {groupResults.length === 0 ? notice("Aucun groupe correspondant. Essaie une autre recherche.") : <>
              <p style={{margin:0,color:"#e0e8ff",fontWeight:700}}>Choisis ton groupe :</p>
              {groupResults.map(group => <button key={group.id} type="button" className="group-entry-blue" style={{...entryButton,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={() => selectPreviewGroup(group)}>
                <span>{group.name}</span><span aria-hidden="true">›</span>
              </button>)}
            </>}
          </div>}
        </>}
        {screen === "recover-account" && <form onSubmit={restoreAccount} style={{display:"grid",gap:12}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:20}}>Se connecter à son compte</h2>
          {notice("Saisis ton pseudo et le mot de passe de ton groupe pour retrouver ton inscription.")}
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={recoveryPseudo} onChange={e=>setRecoveryPseudo(e.target.value)} disabled={pending} style={inputStyle}/>
          <input aria-label="Mot de passe du groupe" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={128} placeholder="Mot de passe du groupe" value={recoveryInput} onChange={e=>{setRecoveryInput(e.target.value);setError("");}} disabled={pending} style={inputStyle}/>
          <button type="submit" className="group-entry-green" style={greenButton} disabled={pending||!firebaseIdentity}>{pending?"Connexion…":"Se connecter"}</button>
          <button type="button" className="group-entry-back" disabled={pending} onClick={()=>{setRecoveryInput("");openEntry("join");}}>Retour</button>
        </form>}
        {screen === "join-group" && selectedGroup && <form onSubmit={submitRealGroup} style={{display:"grid",gap:12}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19}}>Rejoindre {selectedGroup.name}</h2>
          {notice("Inscription réelle dans Firebase test. Utilise un mot de passe réservé au groupe de test.")}
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
          {pseudoFeedback()}
          <input type="password" aria-label="Mot de passe du groupe" autoComplete="off" placeholder="Mot de passe du groupe" maxLength={128} value={groupPassword} onChange={e => setGroupPassword(e.target.value)} style={inputStyle}/>
          <button type="submit" className="group-entry-green" style={greenButton} disabled={pending||!pseudoReady||groupPassword.length<6}>{pending?"Inscription en cours…":"Intégrer le groupe"}</button>
          <button type="button" className="group-entry-back" disabled={pending} onClick={() => {setGroupPassword("");setSelectedGroup(null);setError("");setEntryMode("join");}}>Retour aux résultats</button>
        </form>}
        {screen === "joined-group" && joinedGroup && <>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:21}}>Bienvenue {joinedGroup.pseudo} dans le groupe {joinedGroup.name} !</h2>
          {joinedGroup.type==="public" && <p style={{margin:0,color:"#78ffbd",fontWeight:800}}>Salle publique · {joinedGroup.memberCount}/30 inscrits lors de ta connexion</p>}
          <section style={{padding:12,border:"1px solid #64a9ea",borderRadius:13,textAlign:"left"}}>
            <h3 style={{margin:"0 0 10px",color:"#ffe5ad"}}>Participants ({lobbyMembers.length}/30)</h3>
            {lobbyMembers.map(member=><div key={member.pseudo} style={{padding:"7px 0",color:"#e0e8ff"}}>{member.pseudo}{member.isOwner?" · Créateur":""}</div>)}
          </section>
          {accessControl(false,enterContest,!!lobbyError,joinedGroup.entered===true)}
          {joinedGroup.isOwner&&<button type="button" className="group-entry-blue" style={entryButton} disabled={pending} onClick={()=>startCreatorFlow("creator-login")}>Gérer mon groupe</button>}
        </>}
        {screen === "manage" && <>
          <button type="button" className="group-entry-gold" style={{...entryButton,background:"linear-gradient(135deg,#d9a42d,#ffe078,#e8b63e)",color:"#342303",border:"2px solid #ffdf77",boxShadow:"0 0 12px rgba(255,204,70,.42)"}} disabled={pending} onClick={()=>startCreatorFlow("create-group")}>Créer un groupe</button>
          <button type="button" className="group-entry-blue group-entry-neon" style={entryButton} disabled={pending} onClick={()=>startCreatorFlow("creator-login")}>Gérer mon groupe</button>
        </>}
        {screen === "create-group" && <form onSubmit={createRealGroup} style={{display:"grid",gap:12,textAlign:"left"}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19,textAlign:"center"}}>Créer ton groupe</h2>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Ton pseudo
            <input autoComplete="nickname" maxLength={24} required placeholder="Mon pseudo" value={creatorPseudo} onChange={e=>setCreatorPseudo(e.target.value)} disabled={pending} style={inputStyle}/>
            {pseudoFeedback()}
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Nom du groupe
            <input autoComplete="off" maxLength={80} required placeholder="Nom du groupe" value={creatorName} onChange={e=>setCreatorName(e.target.value)} disabled={pending} style={inputStyle}/>
            {nameFeedback()}
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Mot de passe du groupe
            <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required placeholder="Mot de passe (6 caractères minimum)" value={creatorPassword} onChange={e=>setCreatorPassword(e.target.value)} disabled={pending} style={inputStyle}/>
          </label>
          <p style={{fontSize:14,fontWeight:700,color:"#ffe5ad",margin:0,lineHeight:1.5}}>Crée un mot de passe qui sera partagé avec tes amis. <strong style={{display:"block",color:"#ffcf99",fontWeight:900}}>⚠ N’utilise pas de mot de passe personnel.</strong></p>
          <button type="submit" className="group-entry-green" style={greenButton} disabled={pending||!firebaseIdentity||!nameReady||!pseudoReady||creatorPassword.length<6}>{pending?"Création…":"Créer mon groupe"}</button>
          <button type="button" className="group-entry-back" disabled={pending} onClick={()=>{setCreatorPassword("");openEntry("manage");}}>Retour</button>
        </form>}
        {(screen === "creator-confirm" || screen === "creator-dashboard") && ownerGroup && <>
          <p style={{fontSize:12,color:"#78ffbd",margin:0}}>Groupe enregistré</p>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:21}}>{screen==="creator-confirm"?"Ton groupe est créé !":"Gérer mon groupe"}</h2>
          <div style={{padding:"16px 12px",background:"rgba(84,118,189,.17)",border:"1px solid #64a9ea",borderRadius:13}}>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",overflowWrap:"anywhere"}}>{ownerGroup.name}</div>
            <p style={{margin:"8px 0 0",color:"#c6d3ee"}}>{ownerGroup.memberCount} participant{ownerGroup.memberCount>1?"s":""} · {ownerGroup.pseudo} (créateur)</p>
          </div>
          <button type="button" className="group-entry-invite" style={{...entryButton,background:"linear-gradient(110deg,#b94b24 0%,#c52c68 48%,#8136bd 100%)",border:"2px solid #ff9acf",boxShadow:"0 0 9px rgba(255,115,181,.8), 0 0 22px rgba(229,54,147,.38)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10}} disabled={pending||ownerGroup.locked} onClick={()=>setShowInvitation(true)}><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>Inviter mes amis</button>
          {showInvitation&&ownerGroup.isOwner&&<InvitationPreview key={ownerGroup.id} group={ownerGroup} load={loadInvitation} onClose={()=>setShowInvitation(false)}/>}
          {inviteStatus&&notice(inviteStatus)}
          {pending&&<p role="status" style={{color:"#ffe5ad",margin:0}}>Communication avec le serveur…</p>}
          {accessControl(false,enterContest,!!lobbyError,ownerGroup.entered===true)}
          {screen==="creator-confirm"?<button type="button" className="group-entry-blue" style={entryButton} onClick={()=>{setCreatorPassword("");openEntry("creator-dashboard");}}>Gérer mon groupe</button>:<>
            <section style={{display:"grid",gap:showParticipants?10:0,border:"1px solid #64a9ea",borderRadius:13,background:"rgba(84,118,189,.13)",textAlign:"left",overflow:"hidden"}}>
              <button type="button" className="group-entry-participants" aria-expanded={showParticipants} aria-controls="owner-participants" onClick={()=>setShowParticipants(open=>!open)} style={{...entryButton,minHeight:54,position:"relative",margin:0,padding:"14px 36px",border:0,borderRadius:12,background:"linear-gradient(110deg,#142650,#203e75)",boxShadow:"none",color:"#ffe5ad",fontSize:17}}>Participants ({ownerGroup.memberCount}/30)<span aria-hidden="true" style={{position:"absolute",right:14,top:"50%",transform:showParticipants?"translateY(-50%) rotate(180deg)":"translateY(-50%)",transition:"transform .18s ease",color:"#d7e8ff",fontSize:22,lineHeight:1}}>⌄</span></button>
              <div id="owner-participants" hidden={!showParticipants} style={{padding:showParticipants?"0 12px 12px":0}}>{showParticipants&&<div style={{display:"grid",gap:10}}>
              <button type="button" className="group-entry-blue" disabled={pending} onClick={refreshOwner}>Actualiser la liste</button>
              {ownerGroup.members.map(member=><div key={member.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,borderRadius:9,background:"#1b315d"}}>
                <span style={{flex:1,minWidth:0,overflowWrap:"anywhere",textAlign:"left",paddingRight:10}}>{member.pseudo}</span>{member.isOwner?<span style={{fontSize:12,color:"#ffe5ad"}}>Créateur</span>:<button type="button" className="group-entry-remove" disabled={pending||ownerGroup.locked} onClick={()=>{if(window.confirm("Retirer "+member.pseudo+" du groupe ?"))void ownerAction("remove",undefined,member.id);}}>Retirer</button>}
              </div>)}
              </div>}</div>
            </section>
          </>}
        </>}
        {lobbyGroup&&firebaseIdentity&&<ChatBubble key={lobbyGroup.id} user={{uid:firebaseIdentity,pseudo:lobbyGroup.pseudo}} groupRequest={lobbyChat} roomId={lobbyGroup.id} groupName={lobbyGroup.name}/>}
        {lobbyGroup&&lobbyError&&<p role="alert" style={{color:"#ffd0cf"}}>{lobbyError}</p>}
        {screen !== "home" && <button type="button" className="group-entry-back" disabled={pending} onClick={backToHome} style={{background:"transparent",border:0,color:"#c6d3ee",fontSize:14,padding:8,cursor:"pointer"}}>Retour à l’accueil</button>}
        {error && <p role="alert" style={{color:"#ffd0cf",margin:0}}>{error}</p>}
      </div>
      {demoLoaded && demoEnabled && <div className="demo-entry-link" style={{ textAlign: "center", padding: "25px 10px 0" }}><button type="button" onClick={() => navigate("/demo")} style={{ background: "linear-gradient(110deg,#143b87,#2862bb)", border: "2px solid #dfbe7b", borderRadius: 15, boxShadow: "0 0 18px rgba(39,131,255,.45),0 0 14px rgba(246,198,102,.3)", color: "white", padding: "15px 24px", fontSize: 16, fontWeight: 800 }}>✦ ESSAYER LA DÉMO · SANS INSCRIPTION ✦</button></div>}
      <footer style={{ textAlign: "center", margin: "38px auto 0", padding: "12px 0 20px" }}>
        {window.location.origin===TEST_ORIGIN&&<div style={{display:"grid",justifyItems:"center",gap:9,marginBottom:14}}>
          {simulatedPlayerApp&&<p role="status" style={{color:"#ffd49c",fontSize:13,margin:0}}>Session de joueur simulé · indépendante</p>}
          <button type="button" onClick={openTestPlayer} disabled={pending} style={{background:"rgba(255,255,255,.06)",border:"1px dashed #9ba8c8",borderRadius:10,color:"#dce6ff",fontSize:13,padding:"9px 14px"}}>＋ Simuler un nouveau joueur</button>
          <p style={{color:"#9ba8c8",fontSize:12,margin:0}}>Ouvre un autre onglet sans modifier ton joueur actuel.</p>
          {simulatedPlayerApp&&<a href={TEST_ORIGIN+"/#/login"} style={{color:"#c6d3ee",fontSize:12}}>Revenir à ma session normale</a>}
        </div>}
        {!simulatedPlayerApp&&<a href={adminSessionUrl(window.location.href)} target="_blank" rel="noopener noreferrer" style={{color:"#9ba8c8",fontSize:12,textDecoration:"underline",textUnderlineOffset:3}}>Administrateur</a>}
      </footer>
    </div>
  );
}
