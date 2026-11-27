import test from "node:test";
import assert from "node:assert/strict";
import {chatAction,chatView,adminChatSummary,adminAlertDirectory,verifyRoomReport} from "./chat.mjs";
const fixture=()=>({events:{miss2027:{registration:{groups:{a:{members:{u1:{pseudo:"ADMIN"},u2:{pseudo:"Y"}}},b:{members:{u3:{pseudo:"Z"}}}},membership:{u1:"a",u2:"a",u3:"b"}},players:{u1:{groupId:"a"},u2:{groupId:"a"},u3:{groupId:"b"}}}}});
test("room isolation and server-authoritative author",()=>{
 const r=chatAction(fixture(),{uid:"u1",groupId:"b",text:"Hello",id:"m1",now:1}).state;
 assert.equal(chatView(r,{uid:"u2"}).result.messages[0].admin,false);
 assert.equal(chatView(r,{uid:"u3",groupId:"a"}).result.messages.length,0);
 assert.equal(chatView(r,{uid:"other"}).code,"not_registered");
});
test("private warning and enforced block/unblock",()=>{
 let r=chatAction(fixture(),{uid:"admin",admin:true,groupId:"a",action:"warn",targetUid:"u1",id:"m1",now:1}).state;
 assert.equal(chatView(r,{uid:"u1"}).result.messages[0].admin,true);
 assert.equal(chatView(r,{uid:"u2"}).result.messages.length,0);
 r=chatAction(r,{uid:"admin",admin:true,groupId:"a",action:"block",targetUid:"u1"}).state;
 assert.equal(chatAction(r,{uid:"u1",text:"No",id:"m2",now:2}).code,"chat_blocked");
 assert.equal(chatAction(r,{uid:"u2",action:"unblock",targetUid:"u1"}).code,"admin_required");
 r=chatAction(r,{uid:"admin",admin:true,groupId:"a",action:"unblock",targetUid:"u1"}).state;
 assert.equal(chatAction(r,{uid:"u1",text:"Yes",id:"m2",now:2}).result.accepted,true);
});

test("registered guests can chat before contest opening; removal revokes access",()=>{
 const r=fixture();delete r.events.miss2027.players;
 const sent=chatAction(r,{uid:"u1",text:"Salut",id:"early",now:1});assert.equal(sent.result.accepted,true);
 assert.equal(chatView(sent.state,{uid:"u2"}).result.messages[0].text,"Salut");
 assert.equal(chatView(sent.state,{uid:"u3"}).result.messages.length,0);
 delete sent.state.events.miss2027.registration.membership.u2;
 assert.equal(chatView(sent.state,{uid:"u2"}).code,"not_registered");
});

test("reports are room-isolated, deduplicated, preserved after message eviction, and resolved only by admin",()=>{
 let r=chatAction(fixture(),{uid:"u1",text:"Message",id:"m1",now:1}).state;
 const report={uid:"u2",action:"report",messageId:"m1",now:2};
 assert.equal(chatAction(r,{...report,uid:"u3",groupId:"a"}).code,"invalid_message");
 assert.equal(chatAction(r,{...report,uid:"u1"}).code,"invalid_message");
 r=chatAction(r,report).state;assert.equal(chatAction(r,report).result.alreadyReported,true);
 assert.equal(adminChatSummary(r).a.alerts,1);assert.equal(adminChatSummary(r).b.alerts,0);
 assert.equal(chatView(r,{uid:"u2"}).result.messages[0].reported,true);assert.equal(chatView(r,{uid:"u1"}).result.reports,undefined);
 assert.equal(chatView(r,{uid:"u1"}).result.messages[0].reported,false);
 assert.equal(chatAction(r,{...report,action:"resolve_report"}).code,"admin_required");
 delete r.events.miss2027.chats.a.m1;
 const admin={uid:"admin",admin:true,groupId:"a"};
 assert.equal(chatView(r,admin).result.reports[0].text,"Message");
 assert.equal(chatView(r,admin).result.reports[0].count,1);
 r=chatAction(r,{...admin,action:"resolve_report",messageId:"m1",now:3}).state;
 assert.equal(adminChatSummary(r).a.alerts,0);assert.equal(chatView(r,admin).result.reports.length,0);
});
test("a player can report a visible admin message, but not another player's private warning",()=>{
 let r=chatAction(fixture(),{uid:"admin",admin:true,groupId:"a",action:"warn",targetUid:"u1",id:"w",now:1}).state;
 assert.equal(chatAction(r,{uid:"u2",action:"report",messageId:"w",now:2}).code,"invalid_message");
 r=chatAction(r,{uid:"u1",action:"report",messageId:"w",now:2}).state;
 assert.equal(adminChatSummary(r).a.alerts,1);
});

test("single room alert works even in an empty room, never identifies an accused player, and is private",()=>{
 const request={uid:"u1",action:"report_room",id:"r1",now:2};
 let r=chatAction(fixture(),request).state;
 assert.equal(adminChatSummary(r).a.alerts,1);assert.equal(adminChatSummary(r).b.alerts,0);
 assert.equal(chatAction(r,{...request,id:"r2"}).result.alreadyReported,true);
 r=chatAction(r,{...request,uid:"u2",id:"r3"}).state;
 const admin={uid:"admin",admin:true,groupId:"a"};
 const alert=chatView(r,admin).result.reports[0];assert.equal(alert.roomReport,true);assert.equal(alert.count,2);assert.equal(alert.targetUid,undefined);
 assert.equal(chatView(r,{uid:"u2"}).result.reports,undefined);
 assert.equal(chatAction(r,{uid:"other",action:"report_room",id:"r4",now:3}).code,"not_registered");
 r=chatAction(r,{...admin,action:"resolve_report",messageId:alert.messageId,now:3}).state;
 assert.equal(adminChatSummary(r).a.alerts,0);
 r=chatAction(r,{...request,id:"r5",now:4}).state;assert.equal(adminChatSummary(r).a.alerts,1);
});
test("room alert snapshot excludes private warnings and uses the actual member room",()=>{
 let r=chatAction(fixture(),{uid:"u2",text:"Public",id:"m",now:1}).state;
 r=chatAction(r,{uid:"admin",admin:true,groupId:"a",action:"warn",targetUid:"u1",id:"w",now:2}).state;
 r=chatAction(r,{uid:"u1",groupId:"b",action:"report_room",id:"r",now:3}).state;
 const alert=chatView(r,{uid:"admin",admin:true,groupId:"a"}).result.reports[0];
 assert.deepEqual(alert.context,[{author:"Y",text:"Public",date:1}]);assert.equal(adminChatSummary(r).b.alerts,0);
});

test("room report receipt and fresh JSON round trip agree with global admin alert directory",()=>{
 const out=chatAction(fixture(),{uid:"u1",action:"report_room",id:"r1",now:4});
 const persisted=JSON.parse(JSON.stringify(out.state));
 const receipt={uid:"u1",roomId:out.result.roomId,reportId:out.result.reportId};
 assert.equal(verifyRoomReport(persisted,receipt),true);
 assert.equal(verifyRoomReport(persisted,{...receipt,uid:"u2"}),false);
 assert.equal(verifyRoomReport(fixture(),receipt),false);
 assert.deepEqual(adminAlertDirectory(persisted).map(({id,count})=>({id,count})),[{id:"a",count:1}]);
 const duplicate=chatAction(persisted,{uid:"u1",action:"report_room",id:"r2",now:5});
 assert.equal(duplicate.result.reportId,"r1");
 const resolved=chatAction(persisted,{uid:"admin",admin:true,groupId:"a",action:"resolve_report",messageId:"r1",now:6}).state;
 assert.deepEqual(adminAlertDirectory(resolved),[]);
 assert.equal(verifyRoomReport(resolved,receipt),true);
});

test("vote reminder is private, limited to the open current round and outstanding voters",()=>{
 let r=fixture();r.rooms={miss2027:{gameId:"g",tour:1,votesOpen:true}};
 const params={uid:"admin",admin:true,groupId:"a",action:"vote_reminder",targetUid:"u2",gameId:"g",tour:1,id:"remind",now:100};
 assert.equal(chatAction(r,{...params,admin:false,uid:"u1"}).code,"admin_required");
 assert.equal(chatAction(r,{...params,groupId:"b"}).code,"admin_required");
 assert.equal(chatAction(r,{...params,tour:2}).code,"round_changed");
 assert.equal(chatAction(r,{...params,gameId:"old"}).code,"game_changed");
 const out=chatAction(r,params);assert.equal(out.result.accepted,true);r=out.state;
 assert.equal(chatView(r,{uid:"u1"}).result.messages.length,0);
 assert.equal(chatView(r,{uid:"u3"}).result.voteReminder,null);
 assert.equal(chatView(r,{uid:"u2"}).result.voteReminder.id,"remind");
 assert.equal(chatView(r,{uid:"u2"}).result.messages[0].text,"Merci de valider votre vote !");
 assert.equal(chatAction(r,{...params,id:"again",now:101}).result.alreadySent,true);
 r.events.miss2027.votes={u2:{tour1:[1]}};
 assert.equal(chatView(r,{uid:"u2"}).result.voteReminder,null);
 assert.equal(chatAction(r,{...params,id:"again",now:70000}).code,"already_voted");
 delete r.events.miss2027.votes;r.rooms.miss2027.votesOpen=false;
 assert.equal(chatAction(r,params).code,"votes_closed");assert.equal(chatView(r,{uid:"u2"}).result.voteReminder,null);
});

test("clear alerts affects only one room, preserves chat and moderation, permits a fresh alert",()=>{
 let r=fixture();
 r=chatAction(r,{uid:"u1",text:"Public",id:"m",now:1}).state;
 r=chatAction(r,{uid:"u2",action:"report",messageId:"m",now:2}).state;
 r=chatAction(r,{uid:"u1",action:"report_room",id:"r1",now:3}).state;
 r=chatAction(r,{uid:"u3",action:"report_room",id:"r2",now:4}).state;
 r.events.miss2027.chatModeration={u1:true};
 const before=structuredClone(r.events.miss2027);
 const clear={uid:"admin",admin:true,groupId:"a",action:"clear_room_alerts",now:5};
 assert.equal(chatAction(r,{...clear,admin:false,uid:"u1"}).code,"admin_required");
 const out=chatAction(r,clear);assert.equal(out.result.accepted,true);assert.equal(out.result.clearedIds.length,2);
 r=out.state;assert.equal(adminChatSummary(r).a.alerts,0);assert.equal(adminChatSummary(r).b.alerts,1);
 assert.deepEqual(r.events.miss2027.chats,before.chats);assert.deepEqual(r.events.miss2027.chatModeration,before.chatModeration);
 assert.deepEqual(r.events.miss2027.chatReports.b,before.chatReports.b);
 assert.equal(chatAction(r,clear).result.clearedIds.length,0);
 r=chatAction(r,{uid:"u1",action:"report_room",id:"r3",now:6}).state;
 assert.equal(adminChatSummary(r).a.alerts,1);assert.equal(adminChatSummary(r).b.alerts,1);
});
