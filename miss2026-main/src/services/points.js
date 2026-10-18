// src/services/points.js

// Normalise les données Firebase (tableau ou objets {0:"Miss1"} )
const norm = (d) => {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  return Object.values(d).map((v) => Number(v));
};

/**
 * 🎯 NOUVEAU SYSTÈME DE POINTS (MIS À JOUR)
 *
 * TOUR 1 :
 *    +10 points par bonne miss
 *
 * TOUR 2 :
 *    VERT  = bonne T1 + bonne T2 = +20 pts
 *    JAUNE = bonne T2 seulement  = +10 pts
 *
 * FINALE (place admin) :
 *
 *         ┌───────────────┬──────────────┬──────────────┬──────────────┐
 *         │   Couleur     │    Verte     │    Jaune     │    Neutre    │
 * ┌───────┼───────────────┼──────────────┼──────────────┼──────────────┤
 * │ 1ère  │ Miss France   │    30 pts    │    15 pts    │     7 pts    │
 * │ 2ème  │ 1ère dauph.   │    18 pts    │    10 pts    │     5 pts    │
 * │ 3ème  │ 2ème dauph.   │    12 pts    │     8 pts    │     4 pts    │
 * │ 4ème  │ 3ème dauph.   │    10 pts    │     5 pts    │     3 pts    │
 * │ 5ème  │ 4ème dauph.   │     6 pts    │     3 pts    │     2 pts    │
 * └───────┴───────────────┴──────────────┴──────────────┴──────────────┘
 */

export function calculatePoints(playerVotes, adminSelections) {
  // Normalisation des données
  const t1P = norm(playerVotes.tour1);
  const t2P = norm(playerVotes.tour2);
  const t3P = norm(playerVotes.tour3);

  const t1A = norm(adminSelections.tour1);
  const t2A = norm(adminSelections.tour2);
  const t3A = norm(adminSelections.tour3);

  let total = 0;

  // ----------------------------------------------------------
  // 🔵 TOUR 1 — +10 pts par bonne miss
  // ----------------------------------------------------------
  t1P.forEach((miss) => {
    if (t1A.includes(miss)) total += 10;
  });

  // ----------------------------------------------------------
  // 🟩 TOUR 2 — +20 pts (verte) / +10 pts (jaune)
  // ----------------------------------------------------------
  t2P.forEach((miss) => {
    if (!t2A.includes(miss)) return; // mauvaise au T2

    const isGreen = t1P.includes(miss) && t1A.includes(miss);

    if (isGreen) total += 20;
    else total += 10;
  });

  // ----------------------------------------------------------
  // 🟪 FINALE — comparaison rang par rang
  // ----------------------------------------------------------
  if (t3P.length === 5 && t3A.length === 5) {
    const pointsTable = {
      1: { green: 30, yellow: 15, neutral: 7 },
      2: { green: 18, yellow: 10, neutral: 5 },
      3: { green: 12, yellow: 8, neutral: 4 },
      4: { green: 10, yellow: 5, neutral: 3 },
      5: { green: 6, yellow: 3, neutral: 2 },
    };

    t3P.forEach((miss, index) => {
      const adminRank = t3A.indexOf(miss) + 1;
      if (adminRank <= 0) return;

      const green = t1P.includes(miss) && t1A.includes(miss);
      const yellow =
        t2P.includes(miss) && t2A.includes(miss) && !green;

      const color = green ? "green" : yellow ? "yellow" : "neutral";

      total += pointsTable[adminRank][color];
    });
  }

  return total;
}
