import test from "node:test";
import assert from "node:assert/strict";
import {enterGame,gameView,castVote} from "./game.mjs";
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
