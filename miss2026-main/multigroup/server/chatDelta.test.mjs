import test from "node:test";
import assert from "node:assert/strict";
import {chatDelta} from "./chatDelta.mjs";
const view=messages=>({messages,blocked:false,voteReminder:null});
test("chat sends new messages only, keeps fresh reminder metadata, falls back safely on eviction or changed content",()=>{
 const a={id:"a",text:"first"},b={id:"b",text:"next"},c={id:"c",text:"later"};
 const initial=chatDelta(view([a,b]));
 const noChange=chatDelta({...view([a,b]),voteReminder:{id:"r",text:"vote"}},initial.cursor);
 assert.equal(noChange.delta,true);assert.deepEqual(noChange.messages,[]);assert.equal(noChange.voteReminder.id,"r");
 const added=chatDelta(view([a,b,c]),initial.cursor);assert.equal(added.delta,true);assert.deepEqual(added.messages,[c]);
 assert.equal(chatDelta(view([b,c]),initial.cursor).delta,undefined);
 assert.equal(chatDelta(view([{...a,reported:true},b]),initial.cursor).delta,undefined);
 const empty=chatDelta(view([]));assert.deepEqual(chatDelta(view([a]),empty.cursor).messages,[a]);
});
