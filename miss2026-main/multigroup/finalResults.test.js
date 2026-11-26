import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalResults, rankPlayers } from "./finalResults.js";

const tour1 = Array.from({length:12}, (_,i)=>i+1);
const tour2 = [1,2,3,4,5];
const official = {tour1,tour2,tour3:tour2};
const perfect = {...official,favorite:1};
function fixture() {
  return {
    players:{uidA:{pseudo:"Gérard"},uidB:{pseudo:"Gérard"},uidC:{pseudo:"Sophie"}},
    votesByUid:{uidA:perfect,uidB:perfect,uidC:{tour1,favorite:1}},
    groups:{family:{type:"private"},friends:{type:"private"},public1:{type:"public"}},
    membershipsByGroup:{family:{uidA:true,uidB:true},friends:{},public1:{uidC:true}},
    eligibleUids:["uidA","uidB","uidC","uidA"],adminSelections:official
  };
}
test("one national entry and one group per UID, duplicate pseudos allowed",()=>{
  const r=buildFinalResults(fixture());
  assert.equal(r.national.length,3);
  assert.equal(r.perPlayer.uidA.points,401);
  assert.equal(r.local.family.find(x=>x.uid==="uidA").points,401);
  assert.deepEqual(r.perPlayer.uidA.group,{groupId:"family",rank:1,total:2});
  assert.deepEqual(r.national.map(x=>x.rank),[1,1,3]);
  assert.equal(r.national.filter(x=>x.pseudo==="Gérard").length,2);
});
test("same score can yield a different local rank",()=>{
  const f=fixture(); f.membershipsByGroup.friends={uidC:true}; f.membershipsByGroup.public1={};
  const r=buildFinalResults(f);
  assert.equal(r.perPlayer.uidC.nationalRank,3);
  assert.equal(r.perPlayer.uidC.group.rank,1);
});
test("duplicate predictions rejected",()=>{
  const f=fixture(); f.votesByUid.uidA={...perfect,tour1:Array(12).fill(1)};
  assert.throws(()=>buildFinalResults(f),/Sélection invalide/);
});
test("invalid favorite rejected",()=>{
  const f=fixture(); f.votesByUid.uidA={...perfect,favorite:31};
  assert.throws(()=>buildFinalResults(f),/Coup de cœur invalide/);
});
test("private and public group cannot be combined",()=>{
  const f=fixture();f.membershipsByGroup.friends={uidC:true};
  assert.throws(()=>buildFinalResults(f),/Deux groupes/);
});
test("two private groups forbidden",()=>{
  const f=fixture(); f.membershipsByGroup.friends={uidA:true};
  assert.throws(()=>buildFinalResults(f),/Deux groupes/);
});
test("eligible player must belong to a group",()=>{
  const f=fixture(); f.membershipsByGroup.public1={};
  assert.throws(()=>buildFinalResults(f),/sans groupe/);
});
test("public room maximum 30 members",()=>{
  const f=fixture(); f.membershipsByGroup.public1=Object.fromEntries(Array.from({length:31},(_,i)=>["uid"+i,true]));
  assert.throws(()=>buildFinalResults(f),/30 membres/);
});
test("no participants and no members",()=>{
  const f=fixture();f.eligibleUids=[];const r=buildFinalResults(f);
  assert.deepEqual(r.national,[]);assert.deepEqual(r.local.family,[]);
});
test("rank is independent of pseudo ordering",()=>{
  assert.deepEqual(rankPlayers([{uid:"b",pseudo:"Z",points:7},{uid:"a",pseudo:"A",points:7}]).map(x=>x.rank),[1,1]);
});
