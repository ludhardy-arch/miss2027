// Pure, server-side-oriented V2 foundation. No Firebase connection or writes.
import { calculatePoints } from "../src/services/points.js";

export const PUBLIC_ROOM_CAPACITY = 30;
export const SCHEMA_VERSION = 2;

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
function assertId(id) {
  if (typeof id !== "string" || !id || /[.#$\[\]/\x00-\x1f\x7f]/.test(id) ||
      ["__proto__", "constructor", "prototype"].includes(id)) {
    throw new Error("Identifiant invalide");
  }
}
function list(value, size, optional = false) {
  if (value == null && optional) return undefined;
  if (!value || typeof value !== "object") throw new Error("Sélection invalide");
  const values = Object.values(value);
  if (values.length !== size || new Set(values).size !== size ||
      values.some(v => !Number.isInteger(v) || v < 1 || v > 31)) {
    throw new Error("Sélection invalide");
  }
  return values;
}
function validatedVotes(input = {}) {
  const tour1 = list(input.tour1, 12, true);
  const tour2 = list(input.tour2, 5, true);
  const tour3 = list(input.tour3, 5, true);
  const favorite = input.favorite;
  if (tour1 ? !tour1.includes(favorite) : favorite != null) {
    throw new Error("Coup de cœur invalide");
  }
  return { tour1, tour2, tour3, favorite };
}
function validatedOfficial(input = {}) {
  const tour1 = list(input.tour1, 12);
  const tour2 = list(input.tour2, 5);
  const tour3 = list(input.tour3, 5);
  if (tour2.some(id => !tour1.includes(id)) || tour3.some(id => !tour2.includes(id))) {
    throw new Error("Résultats officiels incohérents");
  }
  return { tour1, tour2, tour3 };
}

// Competition ranking: 1, 1, 3. Alphabetical order is presentation only.
export function rankPlayers(entries) {
  const sorted = [...entries].sort((a,b) =>
    b.points - a.points || a.pseudo.localeCompare(b.pseudo, "fr") || a.uid.localeCompare(b.uid)
  );
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.points !== sorted[i-1].points) rank = i + 1;
    return { ...p, rank };
  });
}

// Call once on a trusted, frozen event snapshot, after official results are final.
// Eligibility and membership-lock policies are supplied by the caller, not inferred here.
// IDs, not display names, determine membership and uniqueness.
export function buildFinalResults({
  players = {}, votesByUid = {}, groups = {}, membershipsByGroup = {},
  eligibleUids, adminSelections, maxGroups=1
}) {
  if (!Array.isArray(eligibleUids)) throw new Error("Liste des joueurs éligibles requise");
  const official = validatedOfficial(adminSelections);
  const uniqueUids = [...new Set(eligibleUids)];
  const entries = uniqueUids.map(uid => {
    assertId(uid);
    if (!own(players, uid) || typeof players[uid]?.pseudo !== "string" ||
        !players[uid].pseudo.trim()) throw new Error("Joueur inconnu ou pseudo invalide");
    const votes = validatedVotes(own(votesByUid, uid) ? votesByUid[uid] : {});
    const points = calculatePoints(votes, official);
    return { uid, pseudo: players[uid].pseudo, points };
  });
  const national = rankPlayers(entries);
  const byUid = new Map(national.map(p => [p.uid, p]));
  const local = Object.create(null);
  const perPlayer = Object.create(null);
  for (const p of national) {
    perPlayer[p.uid] = { points: p.points, nationalRank: p.rank, nationalTotal: national.length, group: null };
  }
  const assignedGroups = new Map();
  for (const [groupId, group] of Object.entries(groups)) {
    assertId(groupId);
    if (!["private", "public"].includes(group.type)) throw new Error("Type de groupe inconnu");
    const membership = own(membershipsByGroup, groupId) ? membershipsByGroup[groupId] : {};
    const memberUids = Object.keys(membership || {}).filter(uid => membership[uid] === true);
    if (group.type === "public" && memberUids.length > PUBLIC_ROOM_CAPACITY) {
      throw new Error("Salle publique au-delà de 30 membres");
    }
    for (const uid of memberUids) {
      assertId(uid);
      if (!own(players, uid)) throw new Error("Membre sans identité");
      const prior=assignedGroups.get(uid)||[];
      if(prior.length>=maxGroups)throw new Error(maxGroups===1?"Deux groupes pour un même joueur":"Plus de trois groupes pour un même joueur");
      assignedGroups.set(uid,[...prior,groupId]);
    }
    const ranking = rankPlayers(memberUids.filter(uid => byUid.has(uid)).map(uid => {
      const { rank, ...entry } = byUid.get(uid);
      return entry;
    }));
    local[groupId] = ranking;
    for (const p of ranking) {
      const result={groupId,rank:p.rank,total:ranking.length};
      if(!perPlayer[p.uid].group)perPlayer[p.uid].group=result;
      if(maxGroups>1)perPlayer[p.uid].groups={...perPlayer[p.uid].groups,[groupId]:result};
    }
  }
  if (national.some(p => !assignedGroups.has(p.uid))) throw new Error("Joueur éligible sans groupe");
  return { national, local, perPlayer };
}
