import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {once} from "node:events";
import {WebSocket} from "ws";
import {attachChatSocket} from "./chatSocket.mjs";
import {chatAction} from "./chat.mjs";
import {applyChatFrame} from "../../src/chatFrame.mjs";

test("live chat: isolated rooms, targeted warnings, sanctions and a single source", {timeout:10000}, async t=>{
 let state={events:{miss2027:{registration:{groups:{a:{members:{u1:{pseudo:"A"},u2:{pseudo:"B"}}},b:{members:{u3:{pseudo:"C"}}}},membership:{u1:"a",u2:"a",u3:"b"}}}}};
 let listener=null, subscriptions=0;
 const rootRef={on(event,fn){subscriptions++;listener=fn;fn({val:()=>state});},off(event,fn){if(listener===fn)listener=null;}};
 const source=()=>listener?.({val:()=>state});
 const server=http.createServer();
 const wss=attachChatSocket(server,{origin:"https://test.invalid",auth:{verifyIdToken:async uid=>({uid,exp:Date.now()/1000+3600,firebase:{sign_in_provider:uid==="admin"?"google.com":"anonymous"}})},rootRef,adminUid:"admin",isReady:()=>true});
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const clients=[];
 t.after(async()=>{for(const ws of clients)ws.terminate();for(const ws of wss.clients)ws.terminate();wss.close();await new Promise(resolve=>server.close(resolve));});
 async function connect(uid,groupId,admin=false){
  const ws=new WebSocket("ws://127.0.0.1:"+server.address().port+"/chat/live",{origin:"https://test.invalid"});
  clients.push(ws);
  const c={ws,view:null,frames:0};
  ws.on("message",raw=>{c.view=applyChatFrame(c.view,JSON.parse(raw.toString()));c.frames++;});
  await once(ws,"open");ws.send(JSON.stringify({type:"subscribe",token:uid,groupId,admin}));return c;
 }
 async function until(fn){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error("timed out");}
 const a=await connect("u1","a"),b=await connect("u2","a"),other=await connect("u3","b");
 await until(()=>a.view&&b.view&&other.view);assert.equal(subscriptions,1);
 const bad=await connect("u3","a");await until(()=>bad.ws.readyState===WebSocket.CLOSED);assert.equal(bad.view,null);
 const forged=await connect("u1","a",true);await until(()=>forged.ws.readyState===WebSocket.CLOSED);assert.equal(forged.view,null);
 function mutate(action){const result=chatAction(state,action);assert.equal(result.result.accepted,true);state=result.state;source();}
 mutate({uid:"u1",groupId:"a",text:"Salut",id:"m1",now:1});
 await until(()=>a.view.messages.length===1&&b.view.messages.length===1);assert.equal(other.view.messages.length,0);assert.equal(other.frames,1);
 mutate({uid:"admin",admin:true,groupId:"a",action:"warn",targetUid:"u1",id:"w1",now:2});
 await until(()=>a.view.messages.length===2);assert.equal(b.view.messages.length,1);
 mutate({uid:"admin",admin:true,groupId:"a",action:"block",targetUid:"u1"});
 await until(()=>a.view.blocked);assert.equal(b.view.blocked,false);
 delete state.events.miss2027.registration.membership.u2;source();
 await until(()=>b.ws.readyState===WebSocket.CLOSED);
});

test("real local WebSocket connections: ramp to 1500 players in groups of 30", {timeout:90000}, async t=>{
 const membership={},groups={};
 for(let i=0;i<1500;i++){
  const uid="u"+i,g="g"+Math.floor(i/30);
  membership[uid]=g;groups[g]??={name:g,members:{}};groups[g].members[uid]={pseudo:uid};
 }
 let state={events:{miss2027:{registration:{groups,membership}}}};
 let listener=null,subscriptions=0;
 const rootRef={on(event,fn){subscriptions++;listener=fn;fn({val:()=>state});},off(event,fn){if(listener===fn)listener=null;}};
 const server=http.createServer();
 const wss=attachChatSocket(server,{origin:"https://test.invalid",auth:{verifyIdToken:async uid=>({uid,exp:Date.now()/1000+3600,firebase:{sign_in_provider:"anonymous"}})},rootRef,adminUid:"admin",isReady:()=>true,maxClients:5000});
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const clients=[];
 t.after(async()=>{for(const c of clients)c.ws.terminate();for(const ws of wss.clients)ws.terminate();wss.close();await new Promise(resolve=>server.close(resolve));});
 async function connect(i){
  const ws=new WebSocket("ws://127.0.0.1:"+server.address().port+"/chat/live",{origin:"https://test.invalid"});
  const c={ws,view:null,frames:0};clients[i]=c;
  ws.on("message",raw=>{c.view=applyChatFrame(c.view,JSON.parse(raw.toString()));c.frames++;});
  await once(ws,"open");ws.send(JSON.stringify({type:"subscribe",token:"u"+i,groupId:"g"+Math.floor(i/30)}));
 }
 async function until(fn){for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error("timed out");}
 let previous=0;
 for(const n of [50,100,250,500,1000,1500]){
  const started=Date.now();
  // Controlled bursts avoid measuring a manufactured authentication denial.
  for(let i=previous;i<n;i+=25)await Promise.all(Array.from({length:Math.min(25,n-i)},(_,j)=>connect(i+j)));
  await until(()=>clients.every(c=>c?.view));
  assert.equal(subscriptions,1);assert.equal(wss.clients.size,n);
  const id="m"+n;
  const result=chatAction(state,{uid:"u0",groupId:"g0",text:"Test "+n,id,now:n});
  assert.equal(result.result.accepted,true);state=result.state;listener({val:()=>state});
  await until(()=>clients.slice(0,30).every(c=>c.view.messages.some(m=>m.id===id)));
  assert.ok(clients.slice(30).every(c=>!c.view.messages.some(m=>m.id===id)));
  t.diagnostic(JSON.stringify({connections:n,elapsedMs:Date.now()-started,rssBytes:process.memoryUsage().rss,sourceSubscriptions:subscriptions}));
  previous=n;
 }
});
