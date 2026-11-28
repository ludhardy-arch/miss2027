import test from "node:test";
import assert from "node:assert/strict";
import {REGISTRATION_OPEN_AT as at} from "../../src/contestSchedule.mjs";
import {scheduledOpening,setConnectionOpening,protectedControlChange} from "./game.mjs";
import {deleteGroup,verifyGroupDeleted} from "./management.mjs";
import {resetContest} from "./reset.mjs";
import {membershipIds} from "./registration.mjs";
const fixture=()=>({rooms:{miss2027:{gameId:"g",tour:1,connectionsOpen:false,votesOpen:false,demoEnabled:true}},events:{miss2027:{registration:{groups:{a:{name:"A",members:{u:{pseudo:"U"},v:{pseudo:"V"}},inviteDigest:"old"},b:{name:"B",members:{u:{pseudo:"U"},w:{pseudo:"W"}}}},membership:{u:["a","b"],v:"a",w:"b"}},players:{u:{groupId:"a"},v:{groupId:"a"},w:{groupId:"b"}},chats:{a:{m:1},b:{n:2}},chatReports:{a:{r:1},b:{s:2}},chatModeration:{u:true,v:true}}},other:{keep:true}});
test("server opens exactly at deadline, only connections, one time",()=>{
 const r=fixture();assert.equal(scheduledOpening(r,at-1).code,"schedule_not_due");
 const out=protectedControlChange(r,x=>scheduledOpening(x,at));assert.equal(out.result.opened,true);
 assert.equal(out.state.rooms.miss2027.connectionsOpen,true);assert.equal(out.state.rooms.miss2027.votesOpen,false);assert.equal(out.state.rooms.miss2027.demoEnabled,false);assert.deepEqual(out.state.events,r.events);
 const closed=setConnectionOpening(out.state,{gameId:"g",open:false,now:at+1}).state;
 assert.equal(scheduledOpening(closed,at+2).code,"schedule_already_handled");
 const reset=resetContest(closed,"game","g2",at+3).state;
 assert.equal(reset.rooms.miss2027.connectionsOpen,false);assert.equal(scheduledOpening(reset,at+4).code,"schedule_already_handled");
});
test("manual controls after deadline and final results cannot be overridden",()=>{
 const r=fixture();const closed=setConnectionOpening(r,{gameId:"g",open:false,now:at}).state;
 assert.equal(scheduledOpening(closed,at+1).code,"schedule_already_handled");
 r.rooms.miss2027.finaleStarted=true;assert.equal(scheduledOpening(r,at).state.rooms.miss2027.connectionsOpen,false);
 const pre=resetContest(fixture(),"game","next",at-1).state;
 assert.equal(scheduledOpening(pre,at).result.opened,true);
});
test("delete one group only and preserve multi-group identity, chat, entry",()=>{
 const r=fixture();const params={groupId:"a",gameId:"g",confirmation:"SUPPRIMER",confirmed:true};
 assert.equal(deleteGroup(r,{...params,confirmed:false}).code,"confirmation_required");
 assert.equal(deleteGroup(r,{...params,gameId:"old"}).code,"game_changed");
 const out=deleteGroup(r,params);assert.equal(out.result.retained,1);assert.equal(out.result.unregistered,1);
 const e=out.state.events.miss2027;
 assert.equal(verifyGroupDeleted(out.state,"a"),true);assert.deepEqual(membershipIds(e.registration,"u"),["b"]);
 assert.equal(e.players.u.groupId,"b");assert.equal(e.players.v,undefined);assert.equal(e.chatModeration.u,true);assert.equal(e.chatModeration.v,undefined);assert.deepEqual(e.chats.b,r.events.miss2027.chats.b);assert.deepEqual(e.chatReports.b,r.events.miss2027.chatReports.b);assert.deepEqual(e.registration.groups.b,r.events.miss2027.registration.groups.b);assert.deepEqual(out.state.other,r.other);
 r.rooms.miss2027.registrationLocked=true;assert.equal(deleteGroup(r,params).code,"membership_locked");
});
