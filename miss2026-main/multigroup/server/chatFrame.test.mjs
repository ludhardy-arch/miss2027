import test from "node:test";
import assert from "node:assert/strict";
import {chatFrame,applyChatFrame} from "../../src/chatFrame.mjs";
const before={messages:Array.from({length:80},(_,i)=>({id:String(i),text:"bonjour"})),blocked:false,voteReminder:null};
test("idle, eviction and reconnect",()=>{
 assert.equal(chatFrame(before,before),null);
 const next={...before,messages:[...before.messages.slice(1),{id:"80",text:"nouveau"}]};
 const frame=chatFrame(before,next);
 assert.equal(frame.drop,1);assert.equal(frame.append.length,1);
 assert.deepEqual(applyChatFrame(before,frame),next);
 assert.deepEqual(applyChatFrame(null,chatFrame(null,next)),next);
});
test("moderation and changed historic messages",()=>{
 const blocked={...before,blocked:true};
 assert.deepEqual(applyChatFrame(before,chatFrame(before,blocked)),blocked);
 const edited={...before,messages:before.messages.map((m,i)=>i===5?{...m,text:"modifié"}:m)};
 assert.equal(chatFrame(before,edited).type,"snapshot");
 assert.deepEqual(applyChatFrame(before,chatFrame(before,edited)),edited);
 assert.throws(()=>applyChatFrame(null,{type:"delta",drop:0,append:[],meta:{}}));
});
