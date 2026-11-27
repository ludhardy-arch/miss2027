import test from "node:test";
import assert from "node:assert/strict";
import {resetContest,verifyReset} from "./reset.mjs";
import {enterGame,gameView,castVote,adminGameView,advanceRound,publishFinal,setVoteOpening,setConnectionOpening,protectedControlChange} from "./game.mjs";
const fixture=()=>({rooms:{miss2027:{gameId:"g1",connectionsOpen:true,votesOpen:true,tour:1,adminSelections:{}}},events:{miss2027:{registration:{groups:{a:{name:"A",members:{u1:{pseudo:"X"},u2:{pseudo:"Y"}}},b:{name:"B",members:{u3:{pseudo:"X"}}}},membership:{u1:"a",u2:"a",u3:"b"}}}}});
const ballot={uid:"u1",gameId:"g1",tour:1,selection:Array.from({length:12},(_,i)=>i+1),favorite:1,now:2};
const enter=(root,uid)=>enterGame(root,{uid,now:1}).state;
test("entry requires membership and initial opening; registered entrants can reconnect when closed",()=>{
 const r=fixture();assert.equal(enterGame(r,{uid:"stranger",now:1}).code,"not_registered");
 let entered=enter(r,"u1");entered.rooms.miss2027.connectionsOpen=false;
 assert.equal(enterGame(entered,{uid:"u2",now:1}).code,"public_closed");
 assert.equal(enterGame(entered,{uid:"u1",now:1}).result.group.id,"a");
});
test("vote is validated and immutable, with idempotent retry",()=>{
 const r=enter(fixture(),"u1");
 assert.equal(castVote(r,{...ballot,selection:Array(12).fill(1)}).code,"invalid_vote");
 assert.equal(castVote(r,{...ballot,favorite:31}).code,"invalid_favorite");
 assert.equal(castVote(r,{...ballot,gameId:"old"}).code,"game_changed");
 const accepted=castVote(r,ballot);
 assert.equal(accepted.result.accepted,true);
 assert.equal(castVote(accepted.state,ballot).result.alreadyRecorded,true);
 assert.equal(castVote(accepted.state,{...ballot,favorite:2}).code,"already_voted");
});
test("only own votes and aggregate room trends; no other group or premature results",()=>{
 let r=enter(enter(enter(fixture(),"u1"),"u2"),"u3");
 r=castVote(r,{...ballot,uid:"u3",favorite:2}).state;
 assert.deepEqual(gameView(r,"u1").result.trend.counts,{});
 r=castVote(r,ballot).state;
 const view=gameView(r,"u1").result;
 assert.equal(view.trend.validated,1);assert.equal(view.trend.total,2);assert.equal(view.trend.counts[1],1);
 assert.equal(view.ownVote.favorite,1);assert.deepEqual(view.adminSelections.tour3,[]);
 assert.equal(view.votes,undefined);assert.equal(view.group.id,"a");
});
test("round 2 uses official twelve and final uses official five; closed round refuses votes",()=>{
 let r=enter(fixture(),"u1");const room=r.rooms.miss2027;
 room.tour=2;room.adminSelections.tour1=ballot.selection;
 const b={...ballot,tour:2,selection:[1,2,3,4,31]};
 assert.equal(castVote(r,b).code,"invalid_vote");
 r=castVote(r,{...b,selection:[1,2,3,4,5]}).state;assert.equal(r.events.miss2027.votes.u1.tour2.length,5);
 r.rooms.miss2027.tour=3;r.rooms.miss2027.adminSelections.tour2=[1,2,3,4,5];r.rooms.miss2027.votesOpen=false;
 assert.equal(castVote(r,{...b,tour:3,selection:[5,4,3,2,1]}).code,"votes_closed");
 r.rooms.miss2027.votesOpen=true;
 assert.deepEqual(castVote(r,{...b,tour:3,selection:[5,4,3,2,1]}).state.events.miss2027.votes.u1.tour3,[5,4,3,2,1]);
});

test("national admin view counts registrations across rooms without merging identical pseudonyms",()=>{
 const r=enter(enter(fixture(),"u1"),"u3");
 const view=adminGameView(castVote(r,ballot).state);
 assert.equal(Object.keys(view.players).length,3);
 assert.equal(view.players.u1.pseudo,view.players.u3.pseudo);
 assert.equal(view.players.u1.tour1.length,12);
 assert.equal(view.players.u3.tour1,undefined);
 assert.equal(view.groupCount,2);
});
test("official selection and round advance are atomic and forbidden during open votes",()=>{
 const r=fixture(),params={gameId:"g1",tour:1,selection:ballot.selection};
 assert.equal(advanceRound(r,params).code,"close_votes_first");
 r.rooms.miss2027.votesOpen=false;
 const next=advanceRound(r,params);
 assert.equal(next.state.rooms.miss2027.tour,2);
 assert.deepEqual(next.state.rooms.miss2027.adminSelections.tour1,ballot.selection);
 assert.equal(advanceRound(next.state,params).code,"round_changed");
});

test("final publication locks game, is idempotent and exposes only the member's local results",()=>{
 let r=enter(enter(fixture(),"u1"),"u3");
 r=castVote(r,ballot).state;
 r=castVote(r,{...ballot,uid:"u3",favorite:2}).state;
 assert.equal(publishFinal(r,{gameId:"g1"}).code,"close_votes_first");
 r.rooms.miss2027={...r.rooms.miss2027,tour:3,votesOpen:false,adminSelections:{tour1:ballot.selection,tour2:[1,2,3,4,5],tour3:[1,2,3,4,5]}};
 assert.equal(gameView(r,"u1").result.final,null);
 const result=publishFinal(r,{gameId:"g1"});assert.equal(result.result.total,2);
 const view=gameView(result.state,"u1").result;
 assert.equal(view.final.local.length,1);assert.equal(view.final.local[0].uid,"u1");
 assert.equal(view.final.personal.nationalRank,1);
 assert.equal(view.final.nationalTotal,2);
 assert.equal(publishFinal(result.state,{gameId:"g1"}).result.alreadyPublished,true);
});

test("registration lock survives closing the first vote window",()=>{
 const root=fixture();root.rooms.miss2027.votesOpen=false;
 const open=setVoteOpening(root,{gameId:"g1",open:true});
 const closed=setVoteOpening(open.state,{gameId:"g1",open:false});
 assert.equal(closed.state.rooms.miss2027.registrationLocked,true);
 assert.equal(closed.state.rooms.miss2027.votesOpen,false);
 assert.equal(setVoteOpening(root,{gameId:"old",open:true}).code,"game_changed");
});

test("fresh server reads restore every saved ballot after disconnect; reset does not accept stale votes",()=>{
 let r=enter(fixture(),"u1");r=castVote(r,ballot).state;
 let restored=gameView(JSON.parse(JSON.stringify(r)),"u1").result;assert.deepEqual(restored.ownVote.tour1,ballot.selection);assert.equal(restored.ownVote.favorite,1);
 r.rooms.miss2027.tour=2;r.rooms.miss2027.adminSelections.tour1=ballot.selection;r=castVote(r,{...ballot,tour:2,selection:[1,2,3,4,5]}).state;
 r.rooms.miss2027.tour=3;r.rooms.miss2027.adminSelections.tour2=[1,2,3,4,5];r=castVote(r,{...ballot,tour:3,selection:[5,4,3,2,1]}).state;
 restored=gameView(JSON.parse(JSON.stringify(r)),"u1").result;assert.deepEqual(restored.ownVote.tour2,[1,2,3,4,5]);assert.deepEqual(restored.ownVote.tour3,[5,4,3,2,1]);assert.equal(restored.ownVote.favorite,1);
 r.rooms.miss2027.gameId="new";assert.equal(castVote(r,ballot).code,"game_changed");
});

test("three registered players survive connections and votes opened or closed in any order",()=>{
 let r=fixture();r.rooms.miss2027.connectionsOpen=false;r.rooms.miss2027.votesOpen=false;
 const event=structuredClone(r.events);
 for(const [fn,open] of [[setConnectionOpening,true],[setVoteOpening,true],[setConnectionOpening,false],[setVoteOpening,false],[setConnectionOpening,true]]){
  const result=protectedControlChange(r,root=>fn(root,{gameId:"g1",open}));
  assert.equal(result.code,undefined);r=result.state;
  assert.deepEqual(r.events,event);
  assert.equal(adminGameView(r).groupCount,2);assert.equal(Object.keys(adminGameView(r).players).length,3);
 }
 for(const uid of ["u1","u2","u3"])r=enter(r,uid);
 r=setVoteOpening(r,{gameId:"g1",open:true}).state;r=castVote(r,ballot).state;
 const saved=structuredClone(r.events);
 r=protectedControlChange(r,root=>setVoteOpening(root,{gameId:"g1",open:false})).state;
 assert.deepEqual(r.events,saved);
 assert.deepEqual(gameView(r,"u1").result.ownVote.tour1,ballot.selection);
 assert.equal(protectedControlChange(r,root=>({state:{...root,events:{}},result:{}})).code,"control_data_changed");
 assert.equal(protectedControlChange(r,root=>({state:{...root,rooms:{miss2027:{gameId:"bad"}}},result:{}})).code,"control_data_changed");
});

test("admin group directory contains public and private rooms without credentials",()=>{
 const root={events:{miss2027:{registration:{groups:{g:{name:"Poupoule",type:"private",secret:"secret",inviteDigest:"hidden",ownerUid:"u1",members:{u1:{pseudo:"Jen",recoveryDigest:"hidden"}}},p:{name:"Salle publique 1",type:"public",members:{}}},membership:{u1:"g"}}}}};
 const view=adminGameView(root);
 assert.equal(view.groupCount,2);
 assert.deepEqual(view.groups,[{id:"g",name:"Poupoule",type:"private",memberCount:1,ownerPseudo:"Jen"},{id:"p",name:"Salle publique 1",type:"public",memberCount:0,ownerPseudo:null}]);
 assert.equal(JSON.stringify(view.groups).includes("hidden"),false);
 assert.equal(JSON.stringify(view.groups).includes("secret"),false);
});

test("reset returns all registered entrants to lobby; closing controls alone never ejects current entrants",()=>{
 let r=enter(enter(enter(fixture(),"u1"),"u2"),"u3");
 r=castVote(r,ballot).state;
 r=setConnectionOpening(r,{gameId:"g1",open:false}).state;
 assert.equal(gameView(r,"u1").result.ownVote.tour1.length,12);
 assert.equal(gameView(r,"u2").result.gameId,"g1");
 assert.equal(enterGame(r,{uid:"u1",now:2}).result.gameId,"g1");
 const registration=structuredClone(r.events.miss2027.registration);
 const fresh=resetContest(r,"game","g2").state;
 assert.equal(verifyReset(fresh,"game","g2"),true);
 assert.deepEqual(fresh.events.miss2027.registration,registration);
 for(const uid of ["u1","u2","u3"]){
  assert.equal(gameView(fresh,uid).code,"lobby_required");
  assert.equal(enterGame(fresh,{uid,now:3}).code,"public_closed");
  assert.equal(adminGameView(fresh).players[uid].entered,false);
 }
 assert.equal(gameView(fresh,"other").code,"not_registered");
 assert.equal(castVote(fresh,ballot).code,"not_registered");
 let opened=setConnectionOpening(fresh,{gameId:"g2",open:true}).state;
 opened=enter(opened,"u1");
 assert.deepEqual(gameView(opened,"u1").result.ownVote,{});
 assert.equal(gameView(opened,"u2").code,"lobby_required");
 opened=setConnectionOpening(opened,{gameId:"g2",open:false}).state;
 assert.equal(gameView(JSON.parse(JSON.stringify(opened)),"u1").result.gameId,"g2");
 assert.equal(gameView(opened,"u2").code,"lobby_required");
});
