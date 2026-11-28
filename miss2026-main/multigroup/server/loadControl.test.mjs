import test from "node:test";
import assert from "node:assert/strict";
import {createReadCache,createVoteQueue} from "./loadControl.mjs";
import {castVote} from "./game.mjs";
import {conditionalWrite} from "./conditional.mjs";
test("1000 simultaneous reads share one fetch; expiry and invalidation force fresh reads",async()=>{
 let reads=0,clock=0;const c=createReadCache(async()=>({n:++reads}),{ttl:1500,clock:()=>clock});
 const results=await Promise.all(Array.from({length:1000},()=>c.get()));
 assert.equal(reads,1);assert.ok(results.every(r=>r.n===1));
 assert.equal(c.stats().coalesced,999);assert.equal((await c.get()).n,1);
 clock=1501;assert.equal((await c.get()).n,2);c.invalidate();assert.equal((await c.get()).n,3);
});
test("failed reads never become stale cache; in-flight old data cannot repopulate after invalidation",async()=>{
 let resolve,reads=0;const c=createReadCache(()=>++reads===1?new Promise(r=>{resolve=r;}):Promise.resolve({fresh:true}));
 const old=c.get();await Promise.resolve();c.invalidate();
 assert.deepEqual(await c.get(),{fresh:true});resolve({fresh:false});await old;
 assert.deepEqual(await c.get(),{fresh:true});
 let n=0;const bad=createReadCache(async()=>{if(++n===1)throw Error("offline");return 42;});
 await assert.rejects(bad.get());assert.equal(await bad.get(),42);
});
test("1000 concurrent ballots persist once in bounded batches, without lost votes",async()=>{
 const membership={},groups={},players={};
 for(let i=0;i<1000;i++){const uid="u"+i,g="g"+Math.floor(i/30);membership[uid]=g;groups[g]??={name:g,members:{}};groups[g].members[uid]={pseudo:uid};players[uid]={groupId:g};}
 let root={rooms:{miss2027:{gameId:"g",tour:1,votesOpen:true}},events:{miss2027:{registration:{groups,membership},players}}},etag=0,writes=0;
 const q=createVoteQueue(operation=>conditionalWrite({operation,read:async()=>({state:root,etag:String(etag)}),write:async(next,match)=>{assert.equal(match,String(etag));root=next;etag++;writes++;return {ok:true,state:root};}}),{windowMs:0,maxBatch:64});
 const ballot=uid=>r=>castVote(r,{uid,gameId:"g",tour:1,selection:Array.from({length:12},(_,i)=>i+1),favorite:1,now:1});
 const out=await Promise.all(Object.keys(membership).map(uid=>q.enqueue(ballot(uid))));
 assert.ok(out.every(x=>x.status===200&&x.body.accepted));assert.equal(Object.keys(root.events.miss2027.votes).length,1000);assert.equal(writes,16);
 const duplicate=await q.enqueue(ballot("u1"));assert.equal(duplicate.body.alreadyRecorded,true);
 root={...root,rooms:{miss2027:{...root.rooms.miss2027,votesOpen:false}}};const closed=await q.enqueue(ballot("u2"));assert.equal(closed.body.error,"votes_closed");
});
test("batch retry respects a concurrent closing of votes",async()=>{
 let root={open:true,votes:[]},etag="a",writes=0;
 const q=createVoteQueue(operation=>conditionalWrite({operation,read:async()=>({state:root,etag}),write:async(state)=>{if(++writes===1){root={...root,open:false};etag="b";return {ok:false};}root=state;return {ok:true,state};}}),{windowMs:0});
 const vote=id=>r=>r.open?{state:{...r,votes:[...r.votes,id]},result:{accepted:true}}:{code:"votes_closed"};
 const out=await Promise.all([q.enqueue(vote(1)),q.enqueue(vote(2))]);assert.ok(out.every(x=>x.body.error==="votes_closed"));assert.deepEqual(root.votes,[]);
});
