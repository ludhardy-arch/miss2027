import test from "node:test";
import assert from "node:assert/strict";
import {chatAction,chatView} from "./chat.mjs";
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
