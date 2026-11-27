// src/App.jsx

import React, { useEffect, useState, useContext } from "react";
import {
  HashRouter as Router,   // ⭐ LA LIGNE IMPORTANTE
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import Demo from "./pages/Demo";
import Admin from "./pages/Admin";
import GameSession from "./GameSession";

import { AppContext } from "./context/AppContext";
import FinaleOverlay from "./components/FinaleOverlay";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function App() {
  return (
    <Router>
      <RouterContent />
    </Router>
  );
}

function RouterContent() {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("miss_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authReady, setAuthReady] = useState(false);
  const [recoveryError,setRecoveryError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true,seq=0;
    const stop=onAuthStateChanged(auth,async firebaseUser=>{
      const n=++seq;
      setRecoveryError("");setAuthReady(false);
      if(!firebaseUser){setUser(null);setAuthReady(true);return;}
      if(firebaseUser.uid===import.meta.env.VITE_ADMIN_UID){
        setUser(old=>old?.role==="admin"&&old.uid===firebaseUser.uid&&!firebaseUser.isAnonymous?old:null);
        setAuthReady(true);return;
      }
      try{
        if(window.location.origin!=="https://miss2027-test.onrender.com")throw Error("Origine test invalide.");
        const token=await firebaseUser.getIdToken();
        const res=await fetch("https://miss2027-test-api.onrender.com/groups/me",{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(45000)});
        if(!res.ok)throw Error("Reconnexion temporairement indisponible.");
        const data=await res.json();
        if(!active||seq!==n||auth.currentUser?.uid!==firebaseUser.uid)return;
        const manual=sessionStorage.getItem("miss_manual_exit")===firebaseUser.uid;
        if(data.group?.entered&&data.gameId&&!manual){
          setUser({role:"player",uid:firebaseUser.uid,pseudo:data.group.pseudo,groupId:data.group.id,groupName:data.group.name,gameId:data.gameId});
        }else setUser(null);
        setAuthReady(true);
      }catch(e){
        if(active&&seq===n){setRecoveryError(e.message||"Reconnexion indisponible.");}
      }
    });
    return()=>{active=false;stop();};
  },[retry]);
  const { finaleStarted, players, adminSelections, gameId } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authReady) return;
    if (user) sessionStorage.setItem("miss_user", JSON.stringify(user));
    else sessionStorage.removeItem("miss_user");
  }, [user,authReady]);

  useEffect(() => {
    if (!authReady||!user) return;

    if (user.role === "admin" && location.pathname !== "/admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (user.role === "player" && !["/player","/waiting"].includes(location.pathname)) {
      navigate("/player", { replace: true });
      return;
    }
  }, [user,authReady]);

  const shouldShowFinale =
    false; // National multigroup result publication will be connected separately.

  // The interactive demo needs no Firebase identity and cannot mutate the game.
  if (location.pathname === "/demo") return <Demo />;

  if (!authReady) return <main className="tv-page"><p role="status">{recoveryError||"Récupération de ta session…"}</p>{recoveryError&&<button onClick={()=>setRetry(n=>n+1)}>Réessayer</button>}</main>;

  return (
    <>
      {shouldShowFinale && (
        <FinaleOverlay
          players={players}
          adminSelections={adminSelections}
          isAdmin={user?.role === "admin"}
        />
      )}

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login setUser={setUser} />} />

        <Route
          path="/admin"
          element={
            user?.role === "admin" ? (
              <Admin user={user} setUser={setUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/player"
          element={
            user?.role === "player" ? (
              <GameSession user={user} setUser={setUser} waiting={false} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/waiting"
          element={
            user?.role==="player" ? <GameSession user={user} setUser={setUser} waiting={true} /> : <Navigate to="/login" replace />
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
