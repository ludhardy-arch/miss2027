import test from "node:test";
import assert from "node:assert/strict";
import { buildTrendSnapshot } from "./trendSnapshot.js";
const ids = Array.from({ length: 31 }, (_, i) => i + 1);
const memberUids = Array.from({ length: 1000 }, (_, i) => "u" + i);
const votesByUid = Object.fromEntries(memberUids.map(uid => [uid, {
  tour1: ids.slice(0, 12), tour2: ids.slice(0, 5), tour3: ids.slice(0, 5)
}]));
test("1000 players: first round totals without personal data", () => {
  const first = buildTrendSnapshot({tour:1,candidateIds:ids,memberUids,votesByUid});
  assert.equal(first.validatedVotes, 1000);
  assert.equal(first.totalPlayers, 1000);
  assert.equal(first.counts[1], 1000);
  assert.equal(first.counts[13], 0);
  assert.equal(JSON.stringify(first).includes("u0"), false);
});
test("final rankings use 5, 4, 3, 2, 1 points", () => {
  const final = buildTrendSnapshot({tour:3,candidateIds:ids.slice(0,5),memberUids,votesByUid});
  assert.deepEqual(Object.values(final.counts), [5000,4000,3000,2000,1000]);
});
test("group scope, duplicate membership, malformed votes and missing vote", () => {
  const small = buildTrendSnapshot({tour:2,candidateIds:ids,memberUids:["u0","u0","u1","missing"],votesByUid:{...votesByUid,u1:{tour2:[1,1,2,3,4]}});
  assert.equal(small.totalPlayers, 3);
  assert.equal(small.validatedVotes, 1);
  assert.equal(small.counts[1], 1);
});
test("empty scope, unknown candidate and bad round", () => {
  const empty = buildTrendSnapshot({tour:1,candidateIds:ids,memberUids:[],votesByUid});
  assert.equal(empty.validatedVotes, 0);
  assert.equal(empty.totalPlayers, 0);
  const bad = buildTrendSnapshot({tour:2,candidateIds:ids,memberUids:["x"],votesByUid:{x:{tour2:[1,2,3,4,99]}}});
  assert.equal(bad.validatedVotes, 0);
  assert.throws(() => buildTrendSnapshot({tour:4,candidateIds:ids,memberUids:[],votesByUid}));
});
