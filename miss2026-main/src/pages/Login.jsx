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


export default function Login({ setUser }) {
  const { connectionsOpen, connectionsLoaded, connectionsError, demoEnabled, demoLoaded } = useContext(AppContext);
  const [pseudo, setPseudo] = useState("");
  const [entryMode, setEntryMode] = useState("home");
  const [groupQuery, setGroupQuery] = useState("");
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
  function openEntry(mode) { setError(""); setEntryMode(mode); }
  function backToHome() {
    setError(""); setEntryMode("home");
    if (invitation) setSearchParams({}, {replace:true});
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
    const label = isPublic ? "Accéder au concours en salle publique" : "Accéder au concours";
    if (canEnter) return <button type="button" onClick={action} disabled={disabled || pending}
      style={{...greenButton,opacity:disabled || pending ? .55 : 1}}>{label}</button>;
    return <div role="status" style={{padding:"15px 12px",borderRadius:13,
      background:"linear-gradient(145deg,#192b50,#101b40)",border:"1px solid #d6b674",
      color:"white",fontWeight:800,textAlign:"center"}}>
      {connectionsError ? "⚠️ Impossible de vérifier les connexions"
        : !connectionsLoaded ? "⏳ Connexion au serveur en cours…"
        : remaining.total > 0 ? <>
          <div style={{fontFamily:"Georgia, serif",fontSize:"clamp(17px,4.8vw,23px)",color:"#fff0d0",marginBottom:14}}>{label} dans :</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:7,fontVariantNumeric:"tabular-nums"}}>
            {[["Jours",remaining.days],["Heures",remaining.hours],["Min",remaining.minutes],["Sec",remaining.seconds]].map(([unit,value]) => (
              <div key={unit} style={{padding:"10px 2px",border:"1px solid rgba(255,220,155,.65)",borderRadius:10,background:"rgba(8,11,34,.65)"}}>
                <div style={{fontSize:"clamp(24px,7vw,39px)",color:"#fff0c2",lineHeight:1.2}}>{String(value).padStart(2,"0")}</div>
                <div style={{fontSize:11,fontWeight:700,color:"#ffdb9b",marginTop:3}}>{unit}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,marginTop:12,fontWeight:600}}>Samedi 12 décembre · 20 h 40 (heure de Paris)</div>
        </> : "⏳ En attente de l’ouverture du concours par l’administrateur"}
    </div>;
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
      <section className="tv-howto tv-howto-v3" aria-label="Comment jouer" style={{ background: "linear-gradient(160deg, #231131, #18112d)", border: "1px solid #bc79be", color: "white", borderRadius: 22, padding: "18px 12px", marginBottom: 20, boxShadow: "0 10px 28px rgba(37,12,56,.23)" }}>
        <div style={{ color: "#f7acd7", letterSpacing: ".12em", fontWeight: 800, fontSize: 13, marginBottom: 6 }}>✦ ✨ COMMENT JOUER ✨ ✦</div>
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
      <div className="tv-entry tv-entry-v3" style={{display:"grid",gap:12}}>
        {screen === "home" && <>
          {accessControl(true, () => openEntry("public"))}
          <button type="button" style={entryButton} onClick={() => openEntry("join")}>Rejoindre un groupe</button>
          <button type="button" style={entryButton} onClick={() => openEntry("manage")}>Créer / Gérer son groupe</button>
        </>}
        {(screen === "public" || screen === "invite") && <>
          {screen === "invite" && <h2 style={{margin:0,color:"#ffe5ad",fontSize:19}}>Bienvenue dans le groupe</h2>}
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
          {accessControl(screen === "public", enterPreview, !pseudo.trim())}
          {screen === "invite" && notice("Le nom du groupe et la validité de l’invitation seront vérifiés à l’étape suivante.")}
        </>}
        {screen === "join" && <form onSubmit={enterPreview} style={{display:"grid",gap:12}}>
          <input aria-label="Mon pseudo" autoComplete="nickname" maxLength={24} placeholder="Mon pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} style={inputStyle}/>
          <input aria-label="Nom du groupe" placeholder="Nom du groupe" value={groupQuery} onChange={e => setGroupQuery(e.target.value)} style={inputStyle}/>
          <button type="submit" style={entryButton} disabled={!pseudo.trim() || !groupQuery.trim()}>Rechercher</button>
          {notice("La recherche et le mot de passe du groupe seront raccordés à l’étape suivante.")}
        </form>}
        {screen === "manage" && <>
          <h2 style={{margin:0,color:"#ffe5ad",fontSize:19}}>Créer / Gérer son groupe</h2>
          {notice("La création et la gestion des groupes seront développées à l’étape suivante.")}
        </>}
        {screen !== "home" && <button type="button" onClick={backToHome} style={{background:"transparent",border:0,color:"#c6d3ee",fontSize:14,padding:8,cursor:"pointer"}}>Retour à l’accueil</button>}
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
