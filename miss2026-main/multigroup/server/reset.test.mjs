import test from "node:test";
import assert from "node:assert/strict";
import {resetContest,verifyReset,registrationCounts} from "./reset.mjs";
import {searchGroups,membershipView} from "./registration.mjs";
const root={other:{keep:true},rooms:{other:{keep:true},miss2027:{tour:3,votesOpen:true,connectionsOpen:true,demoEnabled:false,finaleStarted:true,gameId:"old",players:{Alice:{uid:"u1",connected:true,chatBlocked:true,tour1:[1],favorite:1,score:20}},chat:{m:"hello"},adminSelections:{tour1:[1]}}},events:{miss2027:{registration:{groups:{g:{name:"Test",type:"private",registrationsOpen:true,members:{u1:{pseudo:"Alice"}}}},membership:{u1:"g"}},votes:{u1:{tour1:[1]}},results:{v:1},control:{tour:3,resultsVersion:"v",connectionsOpen:true,custom:1}}}};
test("game reset preserves memberships and chat, closes access and preserves unrelated roots",()=>{
 const r=resetContest(root,"game","new").state;
 assert.deepEqual(r.events.miss2027.registration,root.events.miss2027.registration);
 assert.deepEqual(r.rooms.miss2027.players,{Alice:{uid:"u1",connected:true,chatBlocked:true}});
 assert.deepEqual(r.rooms.miss2027.chat,root.rooms.miss2027.chat);
 assert.equal(r.rooms.miss2027.connectionsOpen,false);
 assert.equal(r.events.miss2027.control.connectionsOpen,false);
 assert.equal(r.rooms.miss2027.demoEnabled,false);
 assert.equal(r.rooms.miss2027.tour,1);
 assert.equal(r.events.miss2027.results,undefined);
 assert.equal(r.events.miss2027.control.custom,1);
 assert.deepEqual(r.other,root.other);
 assert.deepEqual(r.rooms.other,root.rooms.other);
});
test("registration reset refuses an ongoing game and preserves settings after game reset",()=>{
 assert.equal(resetContest(root,"registrations","r").code,"reset_game_first");
 const game=resetContest(root,"game","g").state;
 const r=resetContest(game,"registrations","r").state;
 assert.deepEqual(r.events.miss2027.registration,{epoch:"r"});
 assert.equal(r.rooms.miss2027.players,undefined);
 assert.equal(r.rooms.miss2027.chat,undefined);
 assert.equal(r.rooms.miss2027.connectionsOpen,false);
 assert.equal(r.rooms.miss2027.demoEnabled,false);
 assert.equal(r.events.miss2027.control.custom,1);
 assert.equal(r.rooms.miss2027.tour,game.rooms.miss2027.tour);
 assert.deepEqual(r.other,root.other);
});
test("invalid reset and registration reset without initialized room are rejected",()=>{
 assert.equal(resetContest(root,"other","x").code,"invalid_reset");
 assert.equal(resetContest(null,"registrations","x").code,"room_not_initialized");
});

test("registration reset clears the same registry used by search and recovery",()=>{
 const game=resetContest(root,"game","g").state;
 assert.equal(searchGroups(game.events.miss2027.registration,"Test").length,1);
 assert.equal(membershipView(game.events.miss2027.registration,"u1").id,"g");
 const r=resetContest(game,"registrations","r");
 assert.equal(r.result.before.groups,1);
 assert.equal(r.result.before.players,1);
 assert.deepEqual(registrationCounts(r.state),{groups:0,players:0,chats:0,entered:0});
 assert.equal(verifyReset(r.state,"registrations","r"),true);
 assert.deepEqual(searchGroups(r.state.events.miss2027.registration,"Test"),[]);
 assert.equal(membershipView(r.state.events.miss2027.registration,"u1"),null);
 assert.equal(verifyReset(game,"registrations","r"),false);
 assert.equal(verifyReset(game,"game","g"),true);
 assert.equal(verifyReset({...r.state,events:game.events},"registrations","r"),false);
});
test("blocked reset identifies the reason without altering data",()=>{
 const r=resetContest(root,"registrations","r");
 assert.equal(r.code,"reset_game_first");
 assert.equal(r.reasons.includes("votes_open"),true);
 assert.equal(r.reasons.includes("votes_exist"),true);
 assert.equal(r.state,undefined);
});

test("confirmed game reset initializes missing room without deleting registered groups",()=>{
 const original={events:{miss2027:{registration:root.events.miss2027.registration}},other:{keep:true}};
 const out=resetContest(original,"game","fresh");
 assert.equal(verifyReset(out.state,"game","fresh"),true);
 assert.equal(out.state.rooms.miss2027.connectionsOpen,false);
 assert.deepEqual(out.state.events.miss2027.registration,original.events.miss2027.registration);
 assert.deepEqual(out.state.other,original.other);
 assert.equal(resetContest(original,"registrations","fresh").code,"room_not_initialized");
 assert.equal(verifyReset(resetContest(null,"game","new").state,"game","new"),true);
});

test("game reset keeps reports; registration reset clears them",()=>{
 const r=structuredClone(root);r.events.miss2027.chatReports={g:{m:{status:"pending"}}};
 const game=resetContest(r,"game","g").state;assert.deepEqual(game.events.miss2027.chatReports,r.events.miss2027.chatReports);
 const cleared=resetContest(game,"registrations","r").state;assert.equal(cleared.events.miss2027.chatReports,undefined);assert.equal(verifyReset(cleared,"registrations","r"),true);
});

test("game reset revokes only entry authorizations and verifies all entrants have returned to lobby",()=>{
 const before=structuredClone(root);
 const e=before.events.miss2027;e.players={u1:{groupId:"g",enteredAt:1}};e.chats={g:{m:{text:"hello"}}};e.chatModeration={u1:true};
 const r=resetContest(before,"game","fresh").state;
 assert.deepEqual(r.events.miss2027.registration,e.registration);
 assert.deepEqual(r.events.miss2027.chats,e.chats);
 assert.deepEqual(r.events.miss2027.chatModeration,e.chatModeration);
 assert.deepEqual(registrationCounts(r),{groups:1,players:1,chats:1,entered:0});
 assert.equal(verifyReset(r,"game","fresh"),true);
 const stale=structuredClone(r);stale.events.miss2027.players=e.players;
 assert.equal(verifyReset(stale,"game","fresh"),false);
 stale.events.miss2027.players={};stale.rooms.miss2027.connectionsOpen=true;
 assert.equal(verifyReset(stale,"game","fresh"),false);
 assert.deepEqual(before.events.miss2027.players,e.players);
});
