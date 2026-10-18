// src/context/AppContext.jsx

import React, { createContext, useEffect, useState } from "react";
import { auth, database } from "../firebase";
import { ROOM_PATH, PUBLIC_LIMIT, GOLD_LIMIT } from "../room";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set, update, remove, runTransaction } from "firebase/database";

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [players, setPlayers] = useState({});
  const [adminSelections, setAdminSelections] = useState({
    tour1: [],
    tour2: [],
    tour3: [],
  });

  const [votesOpen, setVotesOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");
  const [tour, setTour] = useState(1);
  const [finaleStarted, setFinaleStarted] = useState(false);

  // utilisé pour la reconnexion automatique
  const [gameId, setGameId] = useState("loading");

  const roomRef = ref(database, ROOM_PATH);

  // -----------------------------------------
  // INIT ROOM (si vide)
  // -----------------------------------------
  useEffect(() => {
    onValue(
      roomRef,
      (snap) => {
        if (snap.exists()) return;

        const newGameId = Date.now().toString();

        set(roomRef, {
          players: {},
          adminSelections: { tour1: [], tour2: [], tour3: [] },
          votesOpen: false,
          connectionsOpen: false,
          tour: 1,
          finaleStarted: false,
          gameId: newGameId,
        });
      },
      { onlyOnce: true }
    );
  }, []);

  // Subscribe only after Firebase has authenticated this device. Firebase RTDB
  // rules require auth != null, including for the connectionsOpen flag.
  useEffect(() => {
    let stopRoomListeners = () => {};
    const stopAuth = onAuthStateChanged(auth, (firebaseUser) => {
      stopRoomListeners();
      stopRoomListeners = () => {};
      setConnectionsLoaded(false);
      setConnectionsError("");
      if (!firebaseUser) return;

      const subscriptions = [
        onValue(ref(database, `${ROOM_PATH}/players`),
          (snap) => setPlayers(snap.val() || {}),
          (error) => console.error("Players sync:", error)),
        onValue(ref(database, `${ROOM_PATH}/adminSelections`),
          (snap) => setAdminSelections(snap.val() || { tour1: [], tour2: [], tour3: [] }),
          (error) => console.error("Selections sync:", error)),
        onValue(ref(database, `${ROOM_PATH}/votesOpen`),
          (snap) => setVotesOpen(snap.val() === true),
          (error) => console.error("Votes sync:", error)),
        onValue(ref(database, `${ROOM_PATH}/connectionsOpen`),
          (snap) => {
            setConnectionsOpen(snap.val() === true);
            setConnectionsLoaded(true);
            setConnectionsError("");
          },
          (error) => {
            setConnectionsLoaded(false);
            setConnectionsError(error?.code || error?.message || "Connexion impossible");
            console.error("Connections sync:", error);
          }),
        onValue(ref(database, `${ROOM_PATH}/tour`),
          (snap) => setTour(snap.val() || 1),
          (error) => console.error("Tour sync:", error)),
        onValue(ref(database, `${ROOM_PATH}/finaleStarted`),
          (snap) => setFinaleStarted(snap.val() === true),
          (error) => console.error("Finale sync:", error)),
        onValue(ref(database, `${ROOM_PATH}/gameId`),
          (snap) => setGameId(snap.val() || "loading"),
          (error) => console.error("Game ID sync:", error))
      ];
      stopRoomListeners = () => subscriptions.forEach(stop => stop());
    }, (error) => {
      setConnectionsError(error?.message || "Authentification indisponible");
      setConnectionsLoaded(false);
    });
    return () => { stopAuth(); stopRoomListeners(); };
  }, []);

  // -----------------------------------------
  // FUNCTIONS
  // -----------------------------------------

  // Friendly game mode: a pseudo is the login. Existing votes are kept.
  // Anyone knowing a pseudo can impersonate it: acceptable only for a trusted group.
  // Atomic registration on the entire player collection. Test Firebase rules
  // must explicitly permit this transaction; otherwise access is denied safely.
  const addPlayer = async (pseudo, uid, goldCode = "") => {
    if (!pseudo || !uid) throw new Error("Pseudo manquant");
    let rejection = "";
    const result = await runTransaction(ref(database, `${ROOM_PATH}/players`), (current) => {
      const all = current || {};
      const existing = all[pseudo];
      if (existing) {
        rejection = existing.uid === uid ? "" : "Ce pseudo est déjà utilisé.";
        return existing.uid === uid ? all : undefined;
      }
      if (Object.values(all).some(player => player?.uid === uid)) {
        rejection = "Ce compte possède déjà un pseudo.";
        return;
      }
      const publicUsed = Object.values(all).filter(player => player?.access !== "gold").length;
      const goldUsed = Object.values(all).filter(player => player?.access === "gold").length;
      const goldMode = publicUsed >= PUBLIC_LIMIT;
      if (goldMode && goldCode.trim().toLowerCase() !== "gral") {
        rejection = "Les places publiques sont complètes. Code GOLD requis.";
        return;
      }
      if (goldMode && goldUsed >= GOLD_LIMIT) {
        rejection = "Toutes les places sont prises.";
        return;
      }
      all[pseudo] = { uid, connected: true, lastSeen: Date.now(), access: goldMode ? "gold" : "public" };
      return all;
    }, { applyLocally: false });
    if (!result.committed) throw new Error(rejection || "Inscription non confirmée.");
    return result.snapshot.val()?.[pseudo];
  };

  // ⭐⭐ FONCTION QUI MANQUAIT → ajoutée ⭐⭐
  const resetPlayerVotes = (pseudo) => {
    remove(ref(database, `${ROOM_PATH}/players/${pseudo}/tour1`));
    remove(ref(database, `${ROOM_PATH}/players/${pseudo}/tour2`));
    remove(ref(database, `${ROOM_PATH}/players/${pseudo}/tour3`));
  };

  const updatePlayerVote = (pseudo, tourNum, selection) => {
    return set(ref(database, `${ROOM_PATH}/players/${pseudo}/tour${tourNum}`), selection);
  };

  // RESET TOTAL
  const resetGame = () => {

    const newGameId = Date.now().toString();

    return set(ref(database, ROOM_PATH), {
      players: {},
      adminSelections: { tour1: [], tour2: [], tour3: [] },
      votesOpen: false,
      connectionsOpen: false,
      tour: 1,
      finaleStarted: false,
      gameId: newGameId,
    });
  };

  const updateAdminSelections = (num, list) =>
    update(ref(database, `${ROOM_PATH}/adminSelections`), {
      [`tour${num}`]: list,
    });

  const updateTour = (num) => set(ref(database, `${ROOM_PATH}/tour`), num);
  const updateVotesOpen = (state) => set(ref(database, `${ROOM_PATH}/votesOpen`), state);
  const updateConnectionsOpen = (state) => set(ref(database, `${ROOM_PATH}/connectionsOpen`), state);
  const updateFinaleStarted = (state) => set(ref(database, `${ROOM_PATH}/finaleStarted`), state);

  // -----------------------------------------
  // PROVIDER
  // -----------------------------------------
  return (
    <AppContext.Provider
      value={{
        players,
        publicUsed: Object.values(players).filter(player => player?.access !== "gold").length,
        goldUsed: Object.values(players).filter(player => player?.access === "gold").length,
        adminSelections,
        votesOpen,
        connectionsOpen,
        connectionsLoaded,
        connectionsError,
        tour,
        finaleStarted,
        gameId,
        addPlayer,
        resetPlayerVotes,   // ⭐ ajouté ⭐
        updatePlayerVote,
        updateAdminSelections,
        updateTour,
        updateVotesOpen,
        updateConnectionsOpen,
        updateFinaleStarted,
        resetGame,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
