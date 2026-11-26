import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged } from "firebase/auth";
 
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


// Temporary, explicitly labelled examples for testing the search interface.
// Never use this list or a client-side password check to grant real membership.
const PREVIEW_GROUPS = [
  {id:"preview-1",name:"La famille des Miss"},
  {id:"preview-2",name:"La famille Bretonne"},
  {id:"preview-3",name:"Les amis de Bretagne"},
  {id:"preview-4",name:"Les amis des Miss"},
  {id:"preview-5",name:"Team Breizh"}
];
const normalizeGroupName = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
function groupMatches(name, query) {
  const n = normalizeGroupName(name), q = normalizeGroupName(query);
  if (!q) return false;
  if (n.includes(q)) return true;
  // Match individual words even when a small typing error is present.
  const distance = (a,b) => {
    let row = Array.from({length:b.length+1},(_,i)=>i);
    for (let i=1;i<=a.length;i++) {
      const next=[i];
      for (let j=1;j<=b.length;j++) next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
      row=next;
    }
    return row[b.length];
  };
  return q.split(" ").every(word => n.split(" ").some(candidate =>
    candidate.includes(word) || (word.length>=4 && distance(word,candidate)<= (word.length>=7?2:1))
  ));
}

export default function Login({ setUser }) {
  const { connectionsOpen, connectionsLoaded, connectionsError, demoEnabled, demoLoaded } = useContext(AppContext);
  const [showRules, setShowRules] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [entryMode, setEntryMode] = useState("home");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupResults, setGroupResults] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupPassword, setGroupPassword] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorPseudo, setCreatorPseudo] = useState("");
  const [previewCreatedGroup, setPreviewCreatedGroup] = useState(null);
  // Dashboard preview only: no group, membership, invitation or credential writes.
  const [previewMembers, setPreviewMembers] = useState([]);
  const [previewRegistrationOpen, setPreviewRegistrationOpen] = useState(true);
  const [previewRename, setPreviewRename] = useState(null);
  const [previewRemoveId, setPreviewRemoveId] = useState(null);
  const [previewInviteOpen, setPreviewInviteOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const invitation = searchParams.get("invite");
  const screen = invitation ? "invite" : entryMode;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [adminUid, setAdminUid] = useState("");
  const [remaining, setRemaining] = useState(getRemainingTime);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const navigate = useNavigate();

  // Authenticate first-time visitors before reading the admin-controlled entry flag.
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser && active) {
        signInAnonymously(auth).catch((error) => {
          if (active) setError("Connexion au serveur impossible : " + (error?.code || error?.message));
        });
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  // No fallback to legacy pseudo-based entry before V2 group assignment exists.
  function openEntry(mode) {
    setError(""); setPreviewRename(null); setPreviewRemoveId(null); setPreviewInviteOpen(false); setEntryMode(mode);
  }
  function backToHome() {
    setError(""); setEntryMode("home");
    setGroupQuery(""); setGroupResults(null); setSelectedGroup(null); setGroupPassword("");
    setPreviewRename(null); setPreviewRemoveId(null); setPreviewInviteOpen(false);
    if (invitation) setSearchParams({}, {replace:true});
  }
  function searchPreviewGroups(event) {
    event.preventDefault();
    setError("");
    setGroupResults(PREVIEW_GROUPS.filter(group => groupMatches(group.name,groupQuery)));
  }
  function selectPreviewGroup(group) {
    setSelectedGroup(group); setGroupPassword(""); setPseudo(""); setError(""); setEntryMode("join-group");
  }
  function submitPreviewGroup(event) {
    event.preventDefault();
    setGroupPassword("");
    setError("Aperçu uniquement : le contrôle du mot de passe et l’inscription seront activés après raccordement sécurisé à la base de test.");
  }
  function createGroupPreview(event) {
    event.preventDefault();
    if (!creatorName.trim() || !creatorPseudo.trim()) return;
    // Only fictitious display information stays in memory; no credentials or writes.
    setPreviewCreatedGroup({name:creatorName.trim(),pseudo:creatorPseudo.trim()});
    setPreviewMembers([]); setPreviewRegistrationOpen(true); setPreviewRename(null); setPreviewRemoveId(null); setPreviewInviteOpen(false);
    event.currentTarget.reset();
    setCreatorName(""); setCreatorPseudo(""); setError(""); setEntryMode("creator-confirm");
  }
  function openCreatorPreview(event) {
    event.preventDefault();
    event.currentTarget.reset();
    setPreviewCreatedGroup(group => group || {name:"La famille des Miss",pseudo:"Créateur test"});
    setPreviewRename(null); setPreviewRemoveId(null); setPreviewInviteOpen(false);
    setError(""); setEntryMode("creator-dashboard");
  }
  function renamePreviewGroup(event) {
    event.preventDefault();
    if (!previewRename?.trim()) return;
    setPreviewCreatedGroup(group => group ? {...group,name:previewRename.trim()} : group);
    setPreviewRename(null);
  }
  function addPreviewMembers() {
    const examples = [{id:"test-1",pseudo:"Camille (test)"},{id:"test-2",pseudo:"Alex (test)"},{id:"test-3",pseudo:"Morgan (test)"}];
    setPreviewMembers(current => [...current,...examples.filter(member => !current.some(existing => existing.id===member.id))]);
  }
  function removePreviewMember(id) {
    setPreviewMembers(current => current.filter(member => member.id!==id));
    setPreviewRemoveId(null);
  }
  function enterPreview(event) {
    event.preventDefault();
    setError("Cette fonction sera raccordée à la nouvelle base de test à l’étape suivante.");
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
  function accessControl(isPublic, action, disabled=false) {
    const label = isPublic ? "Accéder au groupe public" : "Accéder au concours";
    if (canEnter) return <button type="button" className="group-entry-green" onClick={action} disabled={disabled || pending}
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

  async function loginAdmin() {
    setPending(true); setError(""); setAdminUid("");
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const uid = credential.user.uid;
      // This check only controls the interface. Firebase DB rules MUST enforce it server-side.
      if (!import.meta.env.VITE_ADMIN_UID || uid !== import.meta.env.VITE_ADMIN_UID) {
        setAdminUid(uid);
        setError("Compte Google connecté, mais pas encore autorisé comme administrateur.");
        return;
      }
      const userObj = { pseudo: credential.user.displayName || "Admin", role: "admin", uid };
      setUser(userObj);
      navigate("/admin");
    } catch (err) {
      setError("Connexion Google impossible : " + (err?.code || err?.message));
    } finally { setPending(false); }
  }

  return (
    <div className="tv-login-shell tv-show-v3"><div className="tv-entry-stage" aria-hidden="true"><img className="tv-stage-crown" src="/images/couronne-prestige.svg" alt="" aria-hidden="true" style={{ width: "clamp(130px, 32vw, 195px)", height: "auto", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(238,190,107,.5))" }} /></div>
      <header className="tv-hero" style={{ position: "relative", overflow: "hidden", padding: "34px 15px 30px", margin: "-12px -15px 24px", borderRadius: 22, background: "radial-gradient(ellipse at 50% -20%, rgba(248,205,132,.28), transparent 65%), linear-gradient(145deg,#18121b 0%,#0b0c14 100%)", border: "1px solid rgba(232,192,123,.45)", boxShadow: "0 14px 36px rgba(0,0,0,.24)", color: "#fff7e8" }}>
        <img src="/images/couronne-prestige.svg" alt="" aria-hidden="true" style={{ display: "block", width: 108, height: 73, objectFit: "contain", margin: "0 auto 12px", filter: "drop-shadow(0 0 11px rgba(240,198,119,.38))" }} />
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(34px, 9vw, 49px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-.02em", margin: "14px 0 0", color: "#f9e4be", textShadow: "0 2px 22px rgba(238,187,100,.25)" }}>MISS FRANCE <span style={{ display: "block", fontSize: "1.25em", letterSpacing: ".05em" }}>2027</span></h1>
        <div style={{ width: 76, height: 1, margin: "20px auto", background: "linear-gradient(90deg,transparent,#e9c487,transparent)" }} />
        <p style={{ margin: "0 auto", maxWidth: 330, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "clamp(21px, 5.5vw, 27px)", lineHeight: 1.35, color: "#fff9ee" }}>Qui aura le <span style={{ color: "#f2c784" }}>meilleur pronostic ?</span></p>
      </header>
      <div style={{width:"min(100%,600px)",margin:"0 auto 16px"}}>
        <button type="button" aria-expanded={showRules} aria-controls="howto-rules" onClick={() => setShowRules(open => !open)}
          style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",boxSizing:"border-box",width:"100%",height:74,minHeight:74,padding:"18px 42px",borderRadius:13,border:"2px solid #e2a6ff",background:"linear-gradient(135deg,#512578,#8944b4,#512578)",color:"#fff",fontSize:18,fontWeight:800,boxShadow:"0 0 6px #d88aff, 0 0 18px rgba(200,105,255,.75), 0 0 32px rgba(166,71,242,.42), inset 0 0 12px rgba(226,166,255,.28)"}}>
          Comment jouer ?
          <span aria-hidden="true" style={{position:"absolute",right:18,fontSize:20,lineHeight:1,transform:showRules?"rotate(180deg)":"rotate(0deg)",transition:"transform .18s ease"}}>⌄</span>
        </button>
        <div id="howto-rules" hidden={!showRules}>
      <section className="tv-howto tv-howto-v3" aria-label="Comment jouer" style={{ background: "linear-gradient(160deg, #231131, #18112d)", border: "1px solid #bc79be", color: "white", borderRadius: 22, padding: "18px 12px", marginBottom: 0, marginTop: 10, boxShadow: "0 10px 28px rgba(37,12,56,.23)" }}>
        <div style={{textAlign:"left",padding:"12px",marginBottom:14,borderRadius:14,background:"rgba(148,92,205,.17)",border:"1px solid #bc79be",fontSize:15,lineHeight:1.5}}>
          <div style={{fontWeight:800,color:"#f7acd7",marginBottom:8,textAlign:"center"}}>Deux façons de jouer :</div>
          <div style={{marginBottom:8}}>🌍 <strong>En salle publique :</strong> joue seul en rejoignant d’autres participants que tu ne connais pas.</div>
          <div>👥 <strong>En groupe privé :</strong> crée ton groupe ou rejoins celui de tes amis ou de ta famille pour jouer ensemble.</div>
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
        <div style={{ textAlign: "center", margin: "8px 5px 10px", padding: "10px 8px", color: "#ffe6b3", fontWeight: 700, fontSize: 15, lineHeight: 1.4 }}>
          👑 Et pour finir : le show final pour découvrir les résultats !
        </div>
        <p style={{ color: "#ffd49c", margin: "17px 7px 5px", fontSize: 14 }}>✨ Attends l'ouverture des votes à chaque tour.</p>
      </section>
        </div>
      </div>
      <div className="tv-entry tv-entry-v3 group-entry-panel" style={{display:"grid",gap:12}}>
        <style>{`
          .tv-login-shell .group-entry-panel button { margin-top:0; }
          .tv-login-shell .group-entry-panel button.group-entry-blue {
            background:linear-gradient(110deg,#143b87,#2862bb)!important;
            color:#fff!important;border:1px solid #64a9ea!important;
            box-shadow:0 0 12px rgba(39,131,255,.25)!important;font-size:16px;
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
          .tv-login-shell .group-entry-panel button.group-entry-back {
            background:transparent!important;color:#c6d3ee!important;
            border:0!important;box-shadow:none!important;font-size:14px;
          }
        `}</style>
        {screen === "home" && <>
          {accessControl(true, () => openEntry("public"))}
          <button type="button" className="group-entry-blue" style={entryButton} onClick={() => openEntry("join")}>Rejoindre un groupe</button>
          <button type="button" className="group-entry-blue" style={entryButton} onClick={() => openEntry("manage")}>Créer / Gérer son groupe</button>
        </>}
        {(screen === "public" || screen === "invite") && <>
          {screen === "invite" && <h2 style={{margin:0,color:"#ffe5ad",fontSize:19}}>Bienvenue dans le groupe</h2>}
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
          {accessControl(screen === "public", enterPreview, !pseudo.trim())}
          {screen === "invite" && notice("Le nom du groupe et la validité de l’invitation seront vérifiés à l’étape suivante.")}
        </>}
        {screen === "join" && <>
          <form onSubmit={searchPreviewGroups} style={{display:"grid",gap:12}}>
            <input aria-label="Nom du groupe" placeholder="Nom du groupe" maxLength={80} value={groupQuery} onChange={e => {setGroupQuery(e.target.value);setGroupResults(null);setError("");}} style={inputStyle}/>
            <button type="submit" className="group-entry-blue" style={entryButton} disabled={!groupQuery.trim()}>Rechercher</button>
          </form>
          {groupResults !== null && <div aria-live="polite" style={{display:"grid",gap:10,textAlign:"left"}}>
            <p style={{fontSize:12,color:"#ffd49c",margin:"4px 0"}}>Aperçu de test · groupes fictifs</p>
            {groupResults.length === 0 ? notice("Aucun groupe correspondant. Essaie une autre recherche.") : <>
              <p style={{margin:0,color:"#e0e8ff",fontWeight:700}}>Choisis ton groupe :</p>
              {groupResults.map(group => <button key={group.id} type="button" className="group-entry-blue" style={{...entryButton,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={() => selectPreviewGroup(group)}>
                <span>{group.name}</span><span aria-hidden="true">›</span>
              </button>)}
            </>}
          </div>}
        </>}
        {screen === "join-group" && selectedGroup && <form onSubmit={submitPreviewGroup} style={{display:"grid",gap:12}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19}}>Rejoindre {selectedGroup.name}</h2>
          {notice("Aperçu de test · groupe fictif. Aucun mot de passe réel nécessaire.")}
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
          <input type="password" aria-label="Mot de passe du groupe" autoComplete="off" placeholder="Mot de passe du groupe" maxLength={128} value={groupPassword} onChange={e => setGroupPassword(e.target.value)} style={inputStyle}/>
          <button type="submit" className="group-entry-green" style={greenButton} disabled={!pseudo.trim() || !groupPassword.trim()}>Intégrer le groupe</button>
          <button type="button" className="group-entry-back" onClick={() => {setGroupPassword("");setSelectedGroup(null);setError("");setEntryMode("join");}}>Retour aux résultats</button>
        </form>}
        {screen === "manage" && <>
          <button type="button" className="group-entry-blue" style={entryButton} onClick={() => {setCreatorName("");setCreatorPseudo("");openEntry("create-group");}}>Créer un groupe</button>
          <button type="button" className="group-entry-blue" style={entryButton} onClick={() => openEntry("creator-login")}>Gérer mon groupe</button>
        </>}
        {screen === "create-group" && <form onSubmit={createGroupPreview} style={{display:"grid",gap:12,textAlign:"left"}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19,textAlign:"center"}}>Créer ton groupe</h2>
          {notice("Aperçu de test : utilise des informations fictives. Rien n’est enregistré ni envoyé.")}
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Ton pseudo
            <input autoComplete="off" maxLength={24} required placeholder="Mon pseudo" value={creatorPseudo} onChange={e=>setCreatorPseudo(e.target.value)} style={inputStyle}/>
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Nom du groupe
            <input autoComplete="off" maxLength={80} required placeholder="Nom du groupe" value={creatorName} onChange={e=>setCreatorName(e.target.value)} style={inputStyle}/>
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Ton adresse e-mail
            <input type="email" autoComplete="off" required placeholder="exemple@example.com" style={inputStyle}/>
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Mot de passe du groupe
            <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required placeholder="Mot de passe (6 caractères minimum)" style={inputStyle}/>
          </label>
          <p style={{fontSize:12,color:"#c6d3ee",margin:0,lineHeight:1.5}}>Ce mot de passe permet à tes invités de rejoindre ton groupe et te sert aussi à accéder à sa gestion.</p>
          <button type="submit" className="group-entry-green" style={greenButton} disabled={!creatorName.trim() || !creatorPseudo.trim()}>Créer mon groupe</button>
          <button type="button" className="group-entry-back" onClick={()=>openEntry("manage")}>Retour</button>
        </form>}
        {screen === "creator-login" && <form onSubmit={openCreatorPreview} style={{display:"grid",gap:12,textAlign:"left"}}>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19,textAlign:"center"}}>Gérer mon groupe</h2>
          {notice("Aperçu de test : aucune authentification réelle. Utilise des informations fictives.")}
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Ton adresse e-mail
            <input type="email" autoComplete="off" required placeholder="Adresse e-mail" style={inputStyle}/>
          </label>
          <label style={{display:"grid",gap:5,color:"#e0e8ff",fontSize:14}}>Mot de passe du groupe
            <input type="password" autoComplete="off" required placeholder="Mot de passe du groupe" style={inputStyle}/>
          </label>
          <button type="submit" className="group-entry-green" style={greenButton}>Se connecter</button>
          <button type="button" className="group-entry-back" onClick={()=>setError("Aperçu : la réinitialisation du mot de passe sera raccordée à Firebase Auth. Aucun e-mail envoyé.")}>Mot de passe oublié ?</button>
          <button type="button" className="group-entry-back" onClick={()=>openEntry("manage")}>Retour</button>
        </form>}
        {(screen === "creator-confirm" || screen === "creator-dashboard") && previewCreatedGroup && <>
          <p style={{fontSize:12,color:"#ffd49c",margin:0}}>Aperçu de test · aucun groupe réel créé</p>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:21}}>{screen === "creator-confirm" ? "Ton groupe est créé !" : "Gérer mon groupe"}</h2>
          <div style={{padding:"16px 12px",background:"rgba(84,118,189,.17)",border:"1px solid #64a9ea",borderRadius:13}}>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",overflowWrap:"anywhere"}}>{previewCreatedGroup.name}</div>
            <p style={{margin:"8px 0 0",color:"#c6d3ee"}}>{1+previewMembers.length} participant{previewMembers.length ? "s" : ""} · {previewCreatedGroup.pseudo} (créateur)</p>
          </div>
          <button type="button" className="group-entry-blue" style={entryButton} aria-expanded={previewInviteOpen} aria-controls="preview-invite" onClick={()=>{setError("");setPreviewInviteOpen(open=>!open);}}>Inviter mes amis</button>
          {previewInviteOpen && <div id="preview-invite" style={{display:"grid",gap:10,padding:14,border:"1px solid #64a9ea",borderRadius:13,background:"rgba(84,118,189,.13)",textAlign:"left"}}>
            <strong style={{color:"#ffe5ad"}}>Invitation au groupe</strong>
            <p style={{margin:0,lineHeight:1.5}}>Rejoins mon groupe « {previewCreatedGroup.name} » pour le concours de pronostics Miss France 2027 !</p>
            {notice("Le véritable lien d’invitation et le partage seront disponibles après raccordement sécurisé. Aucun lien réel n’est créé ou envoyé pour cet aperçu.")}
          </div>}
          {accessControl(false, enterPreview)}
          {screen === "creator-confirm" ? <button type="button" className="group-entry-blue" style={entryButton} onClick={()=>openEntry("creator-dashboard")}>Gérer mon groupe</button> : <>
            <section aria-label="Participants" style={{display:"grid",gap:10,textAlign:"left",padding:14,border:"1px solid #64a9ea",borderRadius:13,background:"rgba(84,118,189,.13)"}}>
              <h3 style={{margin:0,color:"#ffe5ad",fontSize:17}}>Participants ({1+previewMembers.length})</h3>
              <div style={{padding:10,borderRadius:10,background:"rgba(9,20,58,.55)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <strong style={{overflowWrap:"anywhere",minWidth:0}}>{previewCreatedGroup.pseudo}</strong><span style={{color:"#ffe5ad",fontSize:12,flexShrink:0}}>Créateur</span>
              </div>
              {previewMembers.map(member => <div key={member.id} style={{display:"grid",gap:7,padding:10,borderRadius:10,background:"rgba(9,20,58,.55)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <span style={{overflowWrap:"anywhere",minWidth:0}}>{member.pseudo}</span>
                  <button type="button" className="group-entry-danger" style={{width:"auto",minHeight:36,padding:"6px 10px",borderRadius:8,flexShrink:0}} onClick={()=>setPreviewRemoveId(member.id)}>Retirer</button>
                </div>
                {previewRemoveId===member.id && <div style={{display:"grid",gap:8}}>
                  <p style={{fontSize:13,margin:0,color:"#ffd0cf"}}>Retirer {member.pseudo} du groupe de test ?</p>
                  <div style={{display:"flex",gap:8}}>
                    <button type="button" className="group-entry-danger" style={{flex:1,minHeight:38,borderRadius:8}} onClick={()=>removePreviewMember(member.id)}>Confirmer</button>
                    <button type="button" className="group-entry-back" style={{flex:1,minHeight:38}} onClick={()=>setPreviewRemoveId(null)}>Annuler</button>
                  </div>
                </div>}
              </div>)}
              {previewMembers.length===0 && notice("Tu es actuellement le seul participant.")}
              <button type="button" className="group-entry-back" style={{fontSize:13,minHeight:38}} disabled={previewMembers.length===3} onClick={addPreviewMembers}>+ Ajouter des participants fictifs pour tester</button>
            </section>
            <section aria-label="Paramètres du groupe" style={{display:"grid",gap:10,textAlign:"left",padding:14,border:"1px solid #64a9ea",borderRadius:13,background:"rgba(84,118,189,.13)"}}>
              <h3 style={{margin:0,color:"#ffe5ad",fontSize:17}}>Paramètres du groupe</h3>
              {previewRename===null ? <button type="button" className="group-entry-blue" style={entryButton} onClick={()=>setPreviewRename(previewCreatedGroup.name)}>Modifier le nom du groupe</button> : <form onSubmit={renamePreviewGroup} style={{display:"grid",gap:8}}>
                <input aria-label="Nouveau nom du groupe" value={previewRename} maxLength={80} required onChange={e=>setPreviewRename(e.target.value)} style={inputStyle}/>
                <button type="submit" className="group-entry-blue" style={entryButton} disabled={!previewRename.trim()}>Enregistrer le nom</button>
                <button type="button" className="group-entry-back" onClick={()=>setPreviewRename(null)}>Annuler</button>
              </form>}
              <div style={{padding:10,borderRadius:10,background:"rgba(9,20,58,.55)",display:"grid",gap:8}}>
                <strong>Inscriptions au groupe</strong>
                <span role="status" style={{color:previewRegistrationOpen?"#7effbc":"#ffc4c4",fontWeight:700}}>{previewRegistrationOpen?"● Ouvertes":"● Fermées"}</span>
                <button type="button" className={previewRegistrationOpen?"group-entry-danger":"group-entry-blue"} style={{...entryButton,minHeight:44}} onClick={()=>setPreviewRegistrationOpen(open=>!open)}>{previewRegistrationOpen?"Fermer les inscriptions":"Ouvrir les inscriptions"}</button>
                {notice("Ce réglage concerne uniquement ton groupe. L’ouverture du concours reste contrôlée par la régie.")}
              </div>
            </section>
          </>}
        </>}
        {screen !== "home" && <button type="button" className="group-entry-back" onClick={backToHome} style={{background:"transparent",border:0,color:"#c6d3ee",fontSize:14,padding:8,cursor:"pointer"}}>Retour à l’accueil</button>}
        {error && <p role="alert" style={{color:"#ffd0cf",margin:0}}>{error}</p>}
        {adminUid && <p>Ton UID Firebase : <code>{adminUid}</code> — à renseigner dans Render et dans les règles Firebase.</p>}
      </div>
      {demoLoaded && demoEnabled && <div className="demo-entry-link" style={{ textAlign: "center", padding: "25px 10px 0" }}><button type="button" onClick={() => navigate("/demo")} style={{ background: "linear-gradient(110deg,#143b87,#2862bb)", border: "2px solid #dfbe7b", borderRadius: 15, boxShadow: "0 0 18px rgba(39,131,255,.45),0 0 14px rgba(246,198,102,.3)", color: "white", padding: "15px 24px", fontSize: 16, fontWeight: 800 }}>✦ ESSAYER LA DÉMO · SANS INSCRIPTION ✦</button></div>}
      <footer style={{ textAlign: "center", margin: "38px auto 0", padding: "12px 0 20px" }}>
        <button type="button" onClick={loginAdmin} disabled={pending} style={{ background: "transparent", border: "none", boxShadow: "none", color: "#9ba8c8", padding: "6px 12px", fontSize: 12, fontWeight: 500, letterSpacing: ".025em", textDecoration: "underline", textUnderlineOffset: 3, cursor: pending ? "default" : "pointer", opacity: pending ? .45 : .8 }}>
          Administrateur
        </button>
      </footer>
    </div>
  );
}
