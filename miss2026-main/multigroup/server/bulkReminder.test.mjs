import test from "node:test";
import assert from "node:assert/strict";
import {chatView,chatAction,remindNonVoters,verifyNonVoterReminders} from "./chat.mjs";
const root=()=>({rooms:{miss2027:{gameId:"game",tour:2,votesOpen:true}},events:{miss2027:{registration:{groups:{a:{name:"A",members:{u:{pseudo:"Marc"},v:{pseudo:"Julie"}}},b:{name:"B",members:{u:{pseudo:"Marc"},w:{pseudo:"Sophie"}}}},membership:{u:["a","b"],v:"a",w:"b"}},votes:{v:{tour2:[1,2,3,4,5]},u:{tour1:[1]}}}}});
const args={uid:"admin",admin:true,gameId:"game",tour:2,id:"bulk",now:100000};
test("broadcast only to non-voters of current round, one message per UID, private and visible without chat open",()=>{
 const r=root(),out=remindNonVoters(r,args);
 assert.equal(out.result.sent,2);assert.equal(out.result.eligible,2);
 assert.equal(verifyNonVoterReminders(out.state,out.result.receipts,"game",2),true);
 assert.equal(chatView(out.state,{uid:"u",groupId:"a"}).result.voteReminder.text,"Merci de valider votre vote !");
 assert.equal(chatView(out.state,{uid:"u",groupId:"b"}).result.voteReminder,null);
 assert.equal(chatView(out.state,{uid:"v",groupId:"a"}).result.messages.length,0);
 assert.equal(chatView(out.state,{uid:"w",groupId:"b"}).result.voteReminder.text,"Merci de valider votre vote !");
 const repeat=remindNonVoters(out.state,{...args,id:"again",now:110000});assert.equal(repeat.result.sent,0);assert.equal(repeat.result.skipped,2);
 out.state.events.miss2027.votes.u.tour2=[1,2,3,4,5];
 assert.equal(chatView(out.state,{uid:"u",groupId:"a"}).result.voteReminder,null);
 assert.equal(remindNonVoters(out.state,{...args,id:"later",now:170000}).result.sent,1);
});
test("broadcast rejects unauthorized, stale, closed or finished games and honors existing individual reminder",()=>{
 const r=root();assert.equal(remindNonVoters(r,{...args,admin:false}).code,"admin_required");
 assert.equal(remindNonVoters(r,{...args,tour:1}).code,"round_changed");
 assert.equal(remindNonVoters(r,{...args,gameId:"old"}).code,"game_changed");
 const previous=chatAction(r,{...args,action:"vote_reminder",groupId:"b",targetUid:"u",id:"single"}).state;
 assert.equal(remindNonVoters(previous,args).result.sent,1);
 r.rooms.miss2027.votesOpen=false;assert.equal(remindNonVoters(r,args).code,"votes_closed");
});
