import test from "node:test";
import assert from "node:assert/strict";
import {chatAction,chatView,adminChatSummary} from "./chat.mjs";
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
