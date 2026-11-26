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

import {createGroup} from "./registration.mjs";
import {ownerView,manageGroup,invitationView} from "./management.mjs";
test("confirmed creation survives a fresh read and owner can issue an invitation",async()=>{
 let state={rooms:{miss2027:{tour:1}},events:{miss2027:{registration:{}}}},etag="v1";
 const io={read:async()=>({state:structuredClone(state),etag}),write:async(next,match)=>{assert.equal(match,etag);state=structuredClone(next);etag+="x";return {ok:true,state:structuredClone(state)};}};
 const created=await conditionalWrite({...io,operation:root=>{const out=createGroup(root.events.miss2027.registration,{uid:"owner",id:"g",name:"Test",pseudo:"Créateur",secret:"hash",now:1});return {state:{...root,events:{miss2027:{registration:out.state}}},result:out.result};}});
 assert.equal(created.status,200);assert.equal(ownerView((await io.read()).state,"owner").result.group.id,"g");
 const digest="a".repeat(64);
 const denied=await conditionalWrite({...io,operation:root=>manageGroup(root,{uid:"stranger",action:"invite",digest})});assert.equal(denied.body.error,"owner_required");
 const invited=await conditionalWrite({...io,operation:root=>manageGroup(root,{uid:"owner",action:"invite",digest})});assert.equal(invited.status,200);assert.equal(invitationView((await io.read()).state,digest).result.group.id,"g");
});
