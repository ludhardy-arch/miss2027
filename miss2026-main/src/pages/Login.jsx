import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from "firebase/auth";

export default function Login({ setUser }) {
  const { addPlayer, connectionsOpen } = useContext(AppContext);
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [adminUid, setAdminUid] = useState("");
  const navigate = useNavigate();

  async function loginPlayer() {
    if (!connectionsOpen) { setError("Les connexions sont fermées. Attends que l’administrateur les ouvre."); return; }
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
      if (!connectionsOpen) throw new Error("Les connexions sont fermées.");
      await addPlayer(p, credential.user.uid);
      const userObj = { pseudo: p, role: "player", uid: credential.user.uid };
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
    <div style={{ padding: 40, maxWidth: 500, margin: "0 auto", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <header style={{ position: "relative", overflow: "hidden", padding: "34px 15px 30px", margin: "-12px -15px 24px", borderRadius: 22, background: "radial-gradient(ellipse at 50% -20%, rgba(248,205,132,.28), transparent 65%), linear-gradient(145deg,#18121b 0%,#0b0c14 100%)", border: "1px solid rgba(232,192,123,.45)", boxShadow: "0 14px 36px rgba(0,0,0,.24)", color: "#fff7e8" }}>
        <div aria-hidden="true" style={{ fontSize: 40, color: "#e8c68c", lineHeight: 1, marginBottom: 12 }}>♛</div>
        <div style={{ color: "#e8c68c", fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase" }}>Le concours de pronostics</div>
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(34px, 9vw, 49px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-.02em", margin: "14px 0 0", color: "#f9e4be", textShadow: "0 2px 22px rgba(238,187,100,.25)" }}>MISS PRONO <span style={{ display: "block", fontSize: "1.25em", letterSpacing: ".05em" }}>2027</span></h1>
        <div style={{ width: 76, height: 1, margin: "20px auto", background: "linear-gradient(90deg,transparent,#e9c487,transparent)" }} />
        <p style={{ margin: "0 auto", maxWidth: 330, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "clamp(21px, 5.5vw, 27px)", lineHeight: 1.35, color: "#fff9ee" }}>Qui aura le <span style={{ color: "#f2c784" }}>meilleur pronostic ?</span></p>
      </header>
      <p style={{ background: "rgba(255,255,255,0.85)", color: "#333", padding: 15, borderRadius: 10, lineHeight: 1.45 }}>
        🟣 Premier tour : sélectionner 12 Miss.<br />
        🔵 Deuxième tour : sélectionner 5 Miss.<br />
        🟡 Troisième tour : classer les 5 finalistes.<br />
        Attends l'ouverture des votes à chaque tour.
      </p>
      <p role="status" style={{ padding: 12, borderRadius: 10, background: connectionsOpen ? "#176b43" : "#74323e", color: "white", fontWeight: "bold" }}>{connectionsOpen ? "✅ Connexions ouvertes" : "⏳ Connexions fermées — attends l’ouverture par l’admin"}</p>
      <input disabled={!connectionsOpen || pending} placeholder="Ton pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)}
        style={{ padding: 10, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
      <button onClick={loginPlayer} disabled={pending || !connectionsOpen} style={{ padding: 12, width: "100%", background: "#ff0088", color: "white", border: 0, cursor: "pointer", marginBottom: 18 }}>
        🚀 Participer au concours
      </button>
      <button onClick={loginAdmin} disabled={pending} style={{ padding: 12, width: "100%", cursor: "pointer" }}>
        Se connecter avec Google — Administration
      </button>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {adminUid && <p>Ton UID Firebase : <code>{adminUid}</code> — à renseigner dans Render et dans les règles Firebase.</p>}
    </div>
  );
}
