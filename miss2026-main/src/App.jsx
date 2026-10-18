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
import Admin from "./pages/Admin";
import Player from "./pages/Player";
import Waiting from "./pages/Waiting";

import { AppContext } from "./context/AppContext";
import FinaleOverlay from "./components/FinaleOverlay";

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
      const saved = localStorage.getItem("miss_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const { finaleStarted, players, adminSelections } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) localStorage.setItem("miss_user", JSON.stringify(user));
    else localStorage.removeItem("miss_user");
  }, [user]);

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem("miss_user");
      if (saved) setUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role === "admin" && location.pathname !== "/admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (user.role === "player" && location.pathname !== "/player") {
      navigate("/player", { replace: true });
      return;
    }
  }, [user]);

  const shouldShowFinale =
    finaleStarted && user && location.pathname !== "/login";

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
              <Admin user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/player"
          element={
            user?.role === "player" ? (
              <Player user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/waiting"
          element={
            user ? <Waiting user={user} /> : <Navigate to="/login" replace />
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
