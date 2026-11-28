import test from "node:test";
import assert from "node:assert/strict";
import {createVoteQueue} from "./loadControl.mjs";
import {conditionalWrite} from "./conditional.mjs";
import {castVote} from "./game.mjs";
import {chatAction} from "./chat.mjs";

function fixture(n){
 const membership={},groups={},players={};
 for(let i=0;i<n;i++){
  const uid="u"+i,g="g"+Math.floor(i/30);
  membership[uid]=g;groups[g]??={name:g,members:{}};
  groups[g].members[uid]={pseudo:uid};players[uid]={groupId:g};
 }
 return {rooms:{miss2027:{gameId:"game",tour:1,votesOpen:true}},events:{miss2027:{registration:{groups,membership},players}}};
}
for(const n of [50,100,250,500,1000,1500])test(n+" ballots with concurrent group messages",async()=>{
 let root=fixture(n),etag=0,writes=0,scopes=[],timers=[];
 const q=createVoteQueue((operation,scope)=>conditionalWrite({
  operation,read:async()=>({state:root,etag:String(etag)}),
  write:async(next,match)=>{assert.equal(match,String(etag));root=next;etag++;writes++;scopes.push(scope.chatOnly);return {ok:true,state:root};}
 }),{setTimer:fn=>{timers.push(fn);return timers.length;}});
 const messages=Array.from({length:Math.min(n,200)},(_,i)=>q.enqueueChat(r=>chatAction(r,{uid:"u"+i,groupId:"g"+Math.floor(i/30),text:"Bonjour",id:"m"+i,now:1})));
 const ballots=Array.from({length:n},(_,i)=>q.enqueue(r=>castVote(r,{uid:"u"+i,gameId:"game",tour:1,selection:Array.from({length:12},(_,j)=>j+1),favorite:1,now:2})));
 while(timers.length)await timers.shift()();
 const outcomes=await Promise.all([...ballots,...messages]);
 assert.ok(outcomes.every(o=>o.status===200&&o.body.accepted));
 assert.equal(Object.keys(root.events.miss2027.votes).length,n);
 assert.equal(Object.values(root.events.miss2027.chats).reduce((sum,room)=>sum+Object.keys(room).length,0),messages.length);
 assert.equal(q.stats().accepted,n);assert.equal(q.stats().chatAccepted,messages.length);
 assert.ok(writes<ballots.length+messages.length);
 assert.ok(scopes.includes(true));assert.equal(scopes[0],false);
});
test("a full chat lane cannot consume the reserved vote lane",async()=>{
 const timers=[];
 const q=createVoteQueue(async operation=>({status:200,body:operation({}).result}),{maxChatPending:2,setTimer:fn=>{timers.push(fn);return timers.length;}});
 const op=r=>({state:r,result:{accepted:true}});
 const a=q.enqueueChat(op),b=q.enqueueChat(op);
 assert.equal((await q.enqueueChat(op)).body.error,"chat_queue_busy");
 const vote=q.enqueue(op);
 while(timers.length)await timers.shift()();
 assert.ok((await vote).body.accepted);await Promise.all([a,b]);
});
test("a concurrent block and closing of votes is rechecked on CAS retry",async()=>{
 let root=fixture(2),etag="a",attempt=0,timers=[];
 const q=createVoteQueue(operation=>conditionalWrite({
  operation,read:async()=>({state:root,etag}),write:async(next)=>{
   if(++attempt===1){root={...root,rooms:{miss2027:{...root.rooms.miss2027,votesOpen:false}},events:{miss2027:{...root.events.miss2027,chatModeration:{u1:true}}}};etag="b";return {ok:false};}
   root=next;return {ok:true,state:root};
  }
 }),{setTimer:fn=>{timers.push(fn);return timers.length;}});
 const msg=q.enqueueChat(r=>chatAction(r,{uid:"u1",groupId:"g0",text:"test",id:"m1",now:1}));
 const vote=q.enqueue(r=>castVote(r,{uid:"u0",gameId:"game",tour:1,selection:Array.from({length:12},(_,j)=>j+1),favorite:1,now:2}));
 while(timers.length)await timers.shift()();
 assert.equal((await msg).body.error,"chat_blocked");assert.equal((await vote).body.error,"votes_closed");
 assert.equal(root.events.miss2027.votes,undefined);assert.equal(root.events.miss2027.chats,undefined);
});
