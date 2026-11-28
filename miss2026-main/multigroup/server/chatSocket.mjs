import {WebSocketServer,WebSocket} from "ws";
import {chatView} from "./chat.mjs";
import {chatFrame} from "../../src/chatFrame.mjs";

// Test-only read transport. All mutations still use the existing authenticated HTTP API.
export function attachChatSocket(server,{origin,auth,rootRef,adminUid,isReady,allowChatRead=()=>true,maxClients=1500}){
 const wss=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:false});
 const sessions=new Map(),perUid=new Map();
 let root=null,loaded=false,observing=false,timer=null,authJobs=0;
 const safeKey=k=>typeof k==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(k)&&!["__proto__","constructor","prototype"].includes(k);
 function close(ws,code=1011){try{ws.close(code); }catch{ws.terminate();}}
 function stopIfIdle(){
  if(sessions.size)return;
  if(observing){rootRef.off("value",onRoot);observing=false;}
  if(timer!==null){clearTimeout(timer);timer=null;}
  loaded=false;root=null;
 }
 function publish(ws,s){
  if(!loaded||ws.readyState!==WebSocket.OPEN)return;
  if(!isReady()||(!s.admin&&!allowChatRead()))return close(ws,1013);
  // Existing access control filters private warnings and reports separately for each identity.
  const v=chatView(root,{uid:s.uid,admin:s.admin,groupId:s.groupId});
  if(v.code)return close(ws,1008);
  const frame=chatFrame(s.previous,v.result);
  if(!frame)return;
  if(ws.bufferedAmount>256*1024)return close(ws,1013);
  try{ws.send(JSON.stringify(frame));s.previous=v.result;}catch{ws.terminate();}
 }
 function flush(){
  timer=null;
  for(const [ws,s] of sessions)try{publish(ws,s);}catch{close(ws);}
 }
 function onRoot(snapshot){
  if(!observing)return;
  root=snapshot.val();loaded=true;
  if(timer===null)timer=setTimeout(flush,150);
 }
 function onRootError(){
  for(const ws of sessions.keys())close(ws,1013);
 }
 function start(){
  if(observing)return;
  observing=true;
  rootRef.on("value",onRoot,onRootError);
 }
 server.on("upgrade",(req,socket,head)=>{
  if(req.url!=="/chat/live"||req.headers.origin!==origin||!isReady()||wss.clients.size>=maxClients){
   socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");return;
  }
  wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req));
 });
 wss.on("connection",ws=>{
  let verifying=false,alive=true,expiry=null;
  const timeout=setTimeout(()=>close(ws,1008),12000);
  ws.on("error",()=>ws.terminate());
  ws.on("pong",()=>{alive=true;});
  const heartbeat=setInterval(()=>{
   if(!alive)return ws.terminate();
   alive=false;try{ws.ping();}catch{ws.terminate();}
  },30000);
  ws.once("close",()=>{
   clearTimeout(timeout);clearTimeout(expiry);clearInterval(heartbeat);
   const s=sessions.get(ws);
   if(s){sessions.delete(ws);const n=(perUid.get(s.uid)||1)-1;if(n)perUid.set(s.uid,n);else perUid.delete(s.uid);}
   stopIfIdle();
  });
  ws.on("message",async(raw,isBinary)=>{
   if(verifying||sessions.has(ws)||isBinary)return close(ws,1008);
   verifying=true;
   let msg;try{msg=JSON.parse(raw.toString());}catch{return close(ws,1008);}
   if(msg?.type!=="subscribe"||!safeKey(msg.groupId)||typeof msg.token!=="string"||msg.token.length>12000)return close(ws,1008);
   if(authJobs>=32)return close(ws,1013);
   authJobs++;
   try{
    const user=await auth.verifyIdToken(msg.token,true);
    if(ws.readyState!==WebSocket.OPEN)return;
    if(!safeKey(user.uid)||!isReady()||(perUid.get(user.uid)||0)>=8)return close(ws,1008);
    const admin=msg.admin===true;
    if(admin&&(user.uid!==adminUid||user.firebase?.sign_in_provider!=="google.com"))return close(ws,1008);
    if(!admin&&!allowChatRead())return close(ws,1013);
    const session={uid:user.uid,admin,groupId:msg.groupId,previous:null};
    sessions.set(ws,session);perUid.set(user.uid,(perUid.get(user.uid)||0)+1);
    clearTimeout(timeout);
    // Refresh identity periodically and never outlive the supplied token.
    expiry=setTimeout(()=>close(ws,1000),Math.max(1,Math.min(600000,user.exp*1000-Date.now())));
    start();
    if(loaded)publish(ws,session);
   }catch{close(ws,1008);}
   finally{authJobs--;}
  });
 });
 return wss;
}
