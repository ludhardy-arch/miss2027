import test from "node:test";import assert from "node:assert/strict";import {restoredPlayer,draftKeys,readSaved,writeSaved,sanitizeDraft} from "../../src/sessionRecovery.mjs";
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test("server membership restores a player with no cached profile; non-member and intentional exit stay out",()=>{
 const group={entered:true,id:"g",name:"Famille",pseudo:"A"};
 assert.deepEqual(restoredPlayer("uid",{group,gameId:"123"}),{role:"player",uid:"uid",pseudo:"A",groupId:"g",groupName:"Famille",gameId:"123"});
 assert.equal(restoredPlayer("uid",{group,gameId:"123"},true),null);
 assert.equal(restoredPlayer("uid",{group:null,gameId:"123"}),null);
 assert.equal(restoredPlayer("uid",{group:{...group,entered:false},gameId:"123"}),null);
 assert.equal(restoredPlayer("uid",{group,gameId:"456"}).gameId,"456");
});
test("drafts survive reload, lost tab cache, and isolated tour and account changes",()=>{
 const local=store(),session=store(),k=draftKeys("game",1,"uid");
 assert.equal(writeSaved([local,session],k.draft,[1,2,3]),true);writeSaved([local,session],k.favorite,2);
 assert.deepEqual(readSaved([local,store()],k.draft,[]),[1,2,3]);assert.equal(readSaved([local],k.favorite,null),2);
 assert.deepEqual(readSaved([local],draftKeys("game",2,"uid").draft,[]),[]);
 assert.deepEqual(readSaved([local],draftKeys("other",1,"uid").draft,[]),[]);
 assert.deepEqual(readSaved([local],draftKeys("game",1,"other").draft,[]),[]);
 const rank=draftKeys("game",3,"uid");writeSaved([local],rank.draft,{1:2,2:1});assert.deepEqual(readSaved([local],rank.draft,{}),{1:2,2:1});
});
test("blocked local storage falls back to session storage and invalid drafts are sanitized",()=>{
 const bad={getItem:()=>{throw Error("blocked")},setItem:()=>{throw Error("blocked")}},session=store();
 assert.equal(writeSaved([bad,session],"x",[1,1,99,2]),true);
 assert.deepEqual(sanitizeDraft(readSaved([bad,session],"x",[]),1,[1,2]),[1,2]);
 assert.deepEqual(sanitizeDraft({1:1,2:1,3:8,99:2},3,[1,2,3]),{1:1});
});
