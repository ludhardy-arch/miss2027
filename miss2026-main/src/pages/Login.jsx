// src/pages/Login.jsx

import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

export default function Login({ setUser }) {
  const { addPlayer, resetPlayerVotes } = useContext(AppContext);
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const cleanLocalData = (pseudo) => {
    localStorage.removeItem("miss_user");

    localStorage.removeItem(`miss2026_selection_tour1_${pseudo}`);
    localStorage.removeItem(`miss2026_selection_tour2_${pseudo}`);
    localStorage.removeItem(`miss2026_ranking_tour3_${pseudo}`);
  };

  const handleLogin = () => {
    if (!pseudo.trim()) return alert("Entrez un pseudo !");
    const p = pseudo.trim();

    // ADMIN
    if (password === "1234") {
      cleanLocalData(p);
      const userObj = { pseudo: p, role: "admin" };
      setUser(userObj);
      localStorage.setItem("miss_user", JSON.stringify(userObj));
      navigate("/admin");
      return;
    }

    // PLAYER
    if (password === "ludo") {
      resetPlayerVotes(p);
      cleanLocalData(p);

      addPlayer(p);

      const userObj = { pseudo: p, role: "player" };
      setUser(userObj);
      localStorage.setItem("miss_user", JSON.stringify(userObj));
      navigate("/player");
      return;
    }

    alert("Mot de passe incorrect !");
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 500,
        margin: "0 auto",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 36,
          marginBottom: 10,
          color: "#ff4da6",
          textShadow: "0px 0px 8px rgba(255, 50, 150, 0.4)",
          fontWeight: "bold",
        }}
      >
        🎉 Bienvenue sur Miss2026 !!! 🎉
      </h1>

      <p style={{ fontSize: 20, fontWeight: "bold", marginBottom: 20 }}>
        Qui aura le meilleur pronostic ?
      </p>

      {/* ⭐ INSTRUCTIONS MISES À JOUR (12 MISS AU TOUR 1) ⭐ */}
      <p
        style={{
          fontSize: 16,
          background: "rgba(255,255,255,0.85)",
          padding: 15,
          borderRadius: 10,
          marginBottom: 25,
          color: "#333",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          lineHeight: "1.45",
          fontWeight: 500,
        }}
      >
        ⚠️ <b style={{ color: "#d20055" }}>Important :</b><br />
        Bien attendre que <b>les votes soient ouverts</b> pour sélectionner vos miss.<br />
        La fermeture des votes à chaque tour sera effectuée <b>en même temps qu'à la télé</b> 📺✨
        <br /><br />

        🟣 <b>Premier tour :</b> sélectionner <b>12 miss</b><br />
        🔵 <b>Deuxième tour :</b> sélectionner <b>5 miss</b><br />
        🟡 <b>Troisième tour :</b> classer <b>les 5 finalistes</b>
        <br /><br />

        Bonne chance à tous… et que le meilleur pronostiqueur gagne ! 👑
      </p>

      <p
        style={{
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 10,
          color: "#444",
        }}
      >
        🍺 Site sponsorisé par la bière{" "}
        <span style={{ color: "#d23" }}>Malounette</span>
      </p>

      <img
        src="/images/malounette.jpeg"
        alt="Malounette"
        style={{
          width: "100%",
          maxWidth: 350,
          borderRadius: 12,
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          marginBottom: 25,
        }}
      />

      <input
        placeholder="Ton pseudo"
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 18,
          marginBottom: 15,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <input
        placeholder="Mot de passe"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 18,
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={handleLogin}
        style={{
          padding: "12px 25px",
          fontSize: 20,
          borderRadius: 10,
          background: "#ff0088",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
          border: "none",
          width: "100%",
        }}
      >
        🚀 C'est parti !!!
      </button>
    </div>
  );
}
