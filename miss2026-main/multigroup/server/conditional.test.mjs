import test from "node:test";
import assert from "node:assert/strict";
import {conditionalWrite} from "./conditional.mjs";
test("fresh snapshot and conditional retry preserve concurrent changes",async()=>{
 let state={rooms:{keep:1}},etag="a",writes=0;
 const r=await conditionalWrite({read:async()=>({state,etag}),write:async(next,match)=>{
   assert.equal(match,etag);
   if(++writes===1){state={...state,other:2};etag="b";return {ok:false};}
   state=next;return {ok:true,state};
 },operation:s=>({state:{...s,changed:true},result:{accepted:true}}),verify:s=>s.changed===true});
 assert.equal(r.status,200);assert.deepEqual(state,{rooms:{keep:1},other:2,changed:true});assert.equal(writes,2);
});
test("refusal never writes and failed verification never claims success",async()=>{
 const base={read:async()=>({state:{},etag:"a"}),write:async()=>{throw Error("must not write")}};
 assert.equal((await conditionalWrite({...base,operation:()=>({code:"room_not_initialized"})})).body.error,"room_not_initialized");
 assert.equal((await conditionalWrite({...base,operation:()=>({state:{},result:{}}),verify:()=>false})).body.error,"reset_not_verified");
});
