// src/context/AppContext.jsx

import React, { createContext, useEffect, useState } from "react";
import { auth, database } from "../firebase";
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

  const roomRef = ref(database, "rooms/miss2027");

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
        onValue(ref(database, "rooms/miss2027/players"),
          (snap) => setPlayers(snap.val() || {}),
          (error) => console.error("Players sync:", error)),
        onValue(ref(database, "rooms/miss2027/adminSelections"),
          (snap) => setAdminSelections(snap.val() || { tour1: [], tour2: [], tour3: [] }),
          (error) => console.error("Selections sync:", error)),
        onValue(ref(database, "rooms/miss2027/votesOpen"),
          (snap) => setVotesOpen(snap.val() === true),
          (error) => console.error("Votes sync:", error)),
        onValue(ref(database, "rooms/miss2027/connectionsOpen"),
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
        onValue(ref(database, "rooms/miss2027/tour"),
          (snap) => setTour(snap.val() || 1),
          (error) => console.error("Tour sync:", error)),
        onValue(ref(database, "rooms/miss2027/finaleStarted"),
          (snap) => setFinaleStarted(snap.val() === true),
          (error) => console.error("Finale sync:", error)),
        onValue(ref(database, "rooms/miss2027/gameId"),
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
  const addPlayer = async (pseudo, uid) => {
    if (!pseudo || !uid) throw new Error("Pseudo manquant");
    const playerRef = ref(database, `rooms/miss2027/players/${pseudo}`);
    const result = await runTransaction(playerRef, (current) => {
      if (current !== null) return; // Never overwrite earlier votes or identity on login.
      return { uid, connected: true, lastSeen: Date.now() };
    }, { applyLocally: false });
    return result.snapshot.val();
  };

  // ⭐⭐ FONCTION QUI MANQUAIT → ajoutée ⭐⭐
  const resetPlayerVotes = (pseudo) => {
    remove(ref(database, `rooms/miss2027/players/${pseudo}/tour1`));
    remove(ref(database, `rooms/miss2027/players/${pseudo}/tour2`));
    remove(ref(database, `rooms/miss2027/players/${pseudo}/tour3`));
  };

  const updatePlayerVote = (pseudo, tourNum, selection) => {
    return set(ref(database, `rooms/miss2027/players/${pseudo}/tour${tourNum}`), selection);
  };

  // RESET TOTAL
  const resetGame = () => {

    const newGameId = Date.now().toString();

    set(ref(database, "rooms/miss2027"), {
      players: {},
      adminSelections: { tour1: [], tour2: [], tour3: [] },
      votesOpen: false,
      tour: 1,
      finaleStarted: false,
      gameId: newGameId,
    });
  };

  const updateAdminSelections = (num, list) =>
    update(ref(database, "rooms/miss2027/adminSelections"), {
      [`tour${num}`]: list,
    });

  const updateTour = (num) => set(ref(database, "rooms/miss2027/tour"), num);
  const updateVotesOpen = (state) => set(ref(database, "rooms/miss2027/votesOpen"), state);
  const updateConnectionsOpen = (state) => set(ref(database, "rooms/miss2027/connectionsOpen"), state);
  const updateFinaleStarted = (state) => set(ref(database, "rooms/miss2027/finaleStarted"), state);

  // -----------------------------------------
  // PROVIDER
  // -----------------------------------------
  return (
    <AppContext.Provider
      value={{
        players,
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
