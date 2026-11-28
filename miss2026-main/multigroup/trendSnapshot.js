// Pure aggregation for a trusted backend. Does not access Firebase or publish results.
// Only expose the returned summary to clients; never expose votesByUid.
export function buildTrendSnapshot({tour, candidateIds, memberUids, votesByUid}) {
  if (![1, 2, 3].includes(tour)) throw new Error("Invalid round");
  if (!Array.isArray(candidateIds) || !candidateIds.every(Number.isSafeInteger) || new Set(candidateIds).size !== candidateIds.length) throw new Error("Invalid candidates");
  if (!Array.isArray(memberUids) || !memberUids.every(uid => typeof uid === "string" && uid.length)) throw new Error("Invalid members");
  const members = new Set(memberUids);
  const allowed = new Set(candidateIds);
  const counts = new Map(candidateIds.map(id => [id, 0]));
  const expected = tour === 1 ? 12 : 5;
  let validatedVotes = 0;
  for (const uid of members) {
    if (!Object.hasOwn(votesByUid || {}, uid)) continue;
    const vote = votesByUid[uid]?.[`tour${tour}`];
    if (!Array.isArray(vote) || vote.length !== expected || new Set(vote).size !== expected || !vote.every(id => allowed.has(id))) continue;
    validatedVotes++;
    vote.forEach((id, index) => counts.set(id, counts.get(id) + (tour === 3 ? 5 - index : 1)));
  }
  return {tour, totalPlayers: members.size, validatedVotes, counts: Object.fromEntries(counts)};
}
