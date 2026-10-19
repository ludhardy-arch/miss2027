import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged } from "firebase/auth";

export default function Login({ setUser }) {
  const { addPlayer, connectionsOpen, connectionsLoaded, connectionsError, gameId } = useContext(AppContext);
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [adminUid, setAdminUid] = useState("");
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

  async function loginPlayer() {
    if (!connectionsLoaded || !connectionsOpen) { setError("Les connexions sont fermées. Attends que l’administrateur les ouvre."); return; }
    const p = pseudo.trim().replace(/\s+/g, " ");
    if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_ -]{2,24}$/.test(p)) {
      setError("Choisis un pseudo de 2 à 24 caractères : lettres (accents acceptés), chiffres, espaces, _ ou -.");
      return;
    }
    setPending(true); setError("");
    try {
      // Anonymous Firebase identity, rather than a shared password in source code.
      const credential = await signInAnonymously(auth);
      // The database security rules must bind the pseudo to this UID.
      // Check the current opening state again after Firebase authentication.
      if (!connectionsLoaded || !connectionsOpen) throw new Error("Les connexions sont fermées.");
      await addPlayer(p, credential.user.uid);
      const userObj = { pseudo: p, role: "player", uid: credential.user.uid, gameId };
      setUser(userObj);
      navigate("/player");
    } catch (err) {
      setError("Impossible de rejoindre la partie : " + (err?.code || err?.message));
    } finally { setPending(false); }
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
    <div className="tv-login-shell tv-show-v3"><div className="tv-entry-stage" aria-hidden="true"><span className="tv-stage-crown">♛</span></div>
      <header className="tv-hero" style={{ position: "relative", overflow: "hidden", padding: "34px 15px 30px", margin: "-12px -15px 24px", borderRadius: 22, background: "radial-gradient(ellipse at 50% -20%, rgba(248,205,132,.28), transparent 65%), linear-gradient(145deg,#18121b 0%,#0b0c14 100%)", border: "1px solid rgba(232,192,123,.45)", boxShadow: "0 14px 36px rgba(0,0,0,.24)", color: "#fff7e8" }}>
        <div aria-hidden="true" style={{ fontSize: 40, color: "#e8c68c", lineHeight: 1, marginBottom: 12 }}>♛</div>
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(34px, 9vw, 49px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-.02em", margin: "14px 0 0", color: "#f9e4be", textShadow: "0 2px 22px rgba(238,187,100,.25)" }}>MISS FRANCE <span style={{ display: "block", fontSize: "1.25em", letterSpacing: ".05em" }}>2027</span></h1>
        <div style={{ width: 76, height: 1, margin: "20px auto", background: "linear-gradient(90deg,transparent,#e9c487,transparent)" }} />
        <p style={{ margin: "0 auto", maxWidth: 330, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "clamp(21px, 5.5vw, 27px)", lineHeight: 1.35, color: "#fff9ee" }}>Qui aura le <span style={{ color: "#f2c784" }}>meilleur pronostic ?</span></p>
      </header>
      <section className="tv-howto tv-howto-v3" aria-label="Comment jouer" style={{ background: "linear-gradient(160deg, #231131, #18112d)", border: "1px solid #bc79be", color: "white", borderRadius: 22, padding: "18px 12px", marginBottom: 20, boxShadow: "0 10px 28px rgba(37,12,56,.23)" }}>
        <div style={{ color: "#f7acd7", letterSpacing: ".12em", fontWeight: 800, fontSize: 13, marginBottom: 6 }}>✦ ✨ COMMENT JOUER ✨ ✦</div>
        {[
          { n: "01", text: "Premier tour : sélectionner 12 Miss.", background: "#4e1d57", border: "#e77dc6", accent: "#ffc0e8" },
          { n: "02", text: "Deuxième tour : sélectionner 5 Miss.", background: "#27265b", border: "#a09cff", accent: "#c9bfff" },
          { n: "03", text: "Troisième tour : classer les 5 finalistes.", background: "#163c4f", border: "#68cfd9", accent: "#a2f4f2" }
        ].map(item => (
          <div key={item.n} style={{ display: "flex", alignItems: "center", textAlign: "left", gap: 12, padding: 12, marginBottom: 10, background: item.background, border: `1px solid ${item.border}`, borderRadius: 14 }}>
            <span style={{ flexShrink: 0, width: 43, height: 43, borderRadius: 10, background: "rgba(255,255,255,.12)", color: item.accent, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800 }}>{item.n}</span>
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
        <p style={{ color: "#ffd49c", margin: "17px 7px 5px", fontSize: 14 }}>✨ Attends l'ouverture des votes à chaque tour.</p>
      </section>
      <div className="tv-entry tv-entry-v3"><div className="tv-entry-eyebrow">✦ ACCÈS AU DIRECT ✦</div><h2></h2><p role="status" style={{ padding: "15px 12px", borderRadius: 13, background: connectionsError ? "#93511b" : !connectionsLoaded ? "#56516f" : connectionsOpen ? "linear-gradient(110deg, #003b26, #006f42, #009e63)" : "linear-gradient(110deg, #89000c, #cc0019, #f31337)", border: connectionsLoaded && !connectionsError ? `2px solid ${connectionsOpen ? "#15ef98" : "#ff4d66"}` : "2px solid transparent", boxShadow: connectionsLoaded && !connectionsError ? (connectionsOpen ? "0 0 9px #00e58a, 0 0 20px rgba(0,235,137,.48), inset 0 0 12px rgba(27,255,167,.18)" : "0 0 9px #ff1b42, 0 0 20px rgba(255,27,66,.48), inset 0 0 12px rgba(255,93,111,.2)") : "none", color: "white", fontWeight: 800, letterSpacing: ".025em", textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>
        {connectionsError ? "⚠️ Impossible de vérifier les connexions : " + connectionsError
          : !connectionsLoaded ? "⏳ Connexion au serveur en cours…"
          : connectionsOpen ? "✅ Connexions ouvertes" : "⏳ Connexions fermées — attends l’ouverture par l’admin"}
      </p>
      <input disabled={!connectionsLoaded || !connectionsOpen || pending} placeholder="Ton pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)}
        style={{ padding: 10, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={loginPlayer} disabled={pending || !connectionsLoaded || !connectionsOpen} style={{ padding: 12, width: "100%", background: "#ff0088", color: "white", border: 0, cursor: "pointer", marginBottom: 18 }}>
        🚀 Participer au concours
      </button>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {adminUid && <p>Ton UID Firebase : <code>{adminUid}</code> — à renseigner dans Render et dans les règles Firebase.</p>}
      </div>
      <div className="demo-entry-link" style={{ textAlign: "center", padding: "25px 10px 0" }}><button type="button" onClick={() => navigate("/demo")} style={{ background: "linear-gradient(110deg,#143b87,#2862bb)", border: "2px solid #dfbe7b", borderRadius: 15, boxShadow: "0 0 18px rgba(39,131,255,.45),0 0 14px rgba(246,198,102,.3)", color: "white", padding: "15px 24px", fontSize: 16, fontWeight: 800 }}>✦ ESSAYER LA DÉMO · SANS INSCRIPTION ✦</button></div>
      <footer style={{ textAlign: "center", margin: "38px auto 0", padding: "12px 0 20px" }}>
        <button type="button" onClick={loginAdmin} disabled={pending} style={{ background: "transparent", border: "none", boxShadow: "none", color: "#9ba8c8", padding: "6px 12px", fontSize: 12, fontWeight: 500, letterSpacing: ".025em", textDecoration: "underline", textUnderlineOffset: 3, cursor: pending ? "default" : "pointer", opacity: pending ? .45 : .8 }}>
          Administrateur
        </button>
      </footer>
    </div>
  );
}
