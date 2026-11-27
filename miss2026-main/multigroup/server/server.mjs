import http from "node:http";
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {initializeApp,cert} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {createGroup,joinGroup,searchGroups,registerPublic,membershipView,pseudoAvailable,normalizePseudo,groupNameAvailable,isExcluded} from "./registration.mjs";
import {locked,ownerView,manageGroup,invitationView,acceptInvitation,removePlayer} from "./management.mjs";
import {chatView,chatAction,adminAlertDirectory,verifyRoomReport} from "./chat.mjs";
import {resetContest,verifyReset,registrationCounts} from "./reset.mjs";
import {conditionalWrite} from "./conditional.mjs";
import {authenticateGroupMember} from "./recovery.mjs";
import {invitationKey,sealInvitation,openInvitation} from "./invitationCard.mjs";
import {previewToken,previewDetails,previewPage} from "./richInvitation.mjs";
import {enterGame,gameView,castVote,adminGameView,advanceRound,publishFinal,setVoteOpening,setConnectionOpening,protectedControlChange} from "./game.mjs";

const PROJECT="miss2027-test-v2";
const DATABASE="https://miss2027-test-v2-default-rtdb.europe-west1.firebasedatabase.app";
const ORIGIN="https://miss2027-test.onrender.com";
const registrationEnabled=process.env.ENABLE_TEST_REGISTRATION==="true";
const diagnosticEnabled=process.env.ENABLE_TEST_FIREBASE_CHECK==="true";
if(!registrationEnabled&&!diagnosticEnabled) {
  // Dormant service: never initializes Firebase or accepts registration requests.
  http.createServer((req,res)=>{
    res.writeHead(req.url==="/health"?200:503,{"Content-Type":"application/json","Cache-Control":"no-store"});
    res.end(JSON.stringify({testOnly:true,registrationEnabled:false}));
  }).listen(Number(process.env.PORT||3000),"0.0.0.0");
} else {
let credentials;
try { credentials=JSON.parse(process.env.FIREBASE_TEST_SERVICE_ACCOUNT_JSON||"{}"); }
catch { throw Error("Test Firebase credential is not valid JSON"); }
if(credentials.project_id!==PROJECT || credentials.client_email!=="miss2027-test-api@"+PROJECT+".iam.gserviceaccount.com") throw Error("Only the dedicated test Firebase service account is allowed");
let app;
try { app=initializeApp({credential:cert(credentials),projectId:PROJECT,databaseURL:DATABASE}); }
catch { throw Error("Test Firebase credential could not be initialized"); }
const auth=getAuth(app);
// Separate domain-derived encryption key; no recoverable password in the DB in clear text.
const cardKey=invitationKey(credentials.private_key);
const registry=getDatabase(app).ref("events/miss2027/registration");
const derive=promisify(scrypt);
const digestInvite=token=>createHash("sha256").update(token).digest("hex");
const validInvite=token=>typeof token==="string"&&/^[a-f0-9]{64}$/.test(token);
function registrationChange(root,operation){if(locked(root))return {code:"membership_locked"};const event=root?.events?.miss2027||{},out=operation(event.registration);if(out.code)return out;return {state:{...root,events:{...root?.events,miss2027:{...event,registration:out.state}}},result:out.result};}
const validString=(v,min,max)=>typeof v==="string"&&v.trim().length>=min&&v.length<=max;
const validId=v=>typeof v==="string"&&/^[a-f0-9-]{36}$/.test(v);
const rate=new Map();
const globalRate={count:0,until:0};
let cryptoJobs=0;
function limited(key,max,period=60000) {
  const now=Date.now();
  if(globalRate.until<=now){globalRate.count=0;globalRate.until=now+60000;}
  if(++globalRate.count>1500)return true; // Test-only ceiling; capacity still needs measuring.
  if(rate.size>10000)for(const [k,v] of rate)if(v.until<=now)rate.delete(k);
  if(rate.size>12000&&!rate.has(key))return true;
  let r=rate.get(key);
  if(!r||r.until<=now){r={count:0,until:now+period};rate.set(key,r);}
  return ++r.count>max;
}
async function hash(password,salt=randomBytes(16).toString("hex")) {
  if(cryptoJobs>=4)throw Object.assign(Error("busy"),{status:503});
  cryptoJobs++;
  try{return salt+":"+(await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString("hex");}
  finally{cryptoJobs--;}
}
async function matches(password,encoded) {
  if(typeof encoded!=="string"||!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded))return false;
  const candidate=await hash(password,encoded.split(":")[0]);
  return timingSafeEqual(Buffer.from(candidate),Buffer.from(encoded));
}
function reply(res,status,body){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body));}
async function body(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers["content-type"]||""))throw Object.assign(Error("invalid_content_type"),{status:415});
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8192)throw Object.assign(Error("payload_too_large"),{status:413});chunks.push(chunk);}
  try{const parsed=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();return parsed;}catch{throw Object.assign(Error("invalid_json"),{status:400});}
}
async function atomic(operation,target=registry,verify=null){
  let outcome;
  const tx=await target.transaction(current=>{
    outcome=operation(current);
    // A first local snapshot can be null even when remote data exists. A no-op
    // allows the server to detect conflicts and retry, without deleting state.
    return outcome.state===undefined?current:outcome.state;
  },undefined,false);
  if(!tx.committed||outcome?.code)return {status:409,body:{error:outcome?.code||"conflict",...(outcome?.reasons?{reasons:outcome.reasons}:{})}};
  if(verify){const snapshot=tx.snapshot.val();if(!verify(snapshot))return {status:409,body:{error:"reset_not_verified"}};return {status:200,body:{...outcome.result,verified:true,remaining:registrationCounts(snapshot)}};}
  return {status:200,body:outcome.result};
}
async function directRootAccess(){
  // The URL is fixed to the dedicated test project and cannot be supplied by the caller.
  const url=DATABASE+"/.json";
  const token=await app.options.credential.getAccessToken();
  const headers={Authorization:"Bearer "+token.access_token};
  const read=async()=>{
    const response=await fetch(url,{headers:{...headers,"X-Firebase-ETag":"true"},cache:"no-store",signal:AbortSignal.timeout(12000),redirect:"error"});
    if(!response.ok)throw Object.assign(Error("database_read_failed"),{status:503});
    return {state:await response.json(),etag:response.headers.get("etag")};
  };
  const write=async(state,etag)=>{
    const response=await fetch(url,{method:"PUT",headers:{...headers,"Content-Type":"application/json","If-Match":etag},body:JSON.stringify(state),signal:AbortSignal.timeout(12000),redirect:"error"});
    if(response.status===412)return {ok:false};
    if(!response.ok)throw Object.assign(Error("database_write_failed"),{status:503});
    return {ok:true,state:await response.json()};
  };
  return {read,write};
}
async function directRootRead(){return (await (await directRootAccess()).read()).state;}
async function directRootChange(operation,verify){
  const access=await directRootAccess();
  return conditionalWrite({...access,operation,verify});
}
async function directReset(kind,id){
  const {read,write}=await directRootAccess();
  const outcome=await conditionalWrite({read,write,operation:state=>resetContest(state,kind,id),verify:state=>verifyReset(state,kind,id)});
  if(outcome.status!==200)return outcome;
  const after=await read();
  if(!verifyReset(after.state,kind,id))return {status:409,body:{error:"reset_not_verified"}};
  return {status:200,body:{...outcome.body,verified:true,remaining:registrationCounts(after.state)}};
}
const readiness={auth:"pending",databaseRead:"pending",databaseWrite:"pending"};
async function check(label,work){
  let timer;
  try {
    await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("timeout")),20000);})]);
    readiness[label]="ok";
  }catch{readiness[label]="failed";}
  finally{clearTimeout(timer);}
}
async function verifyTestFirebase(){
  await Promise.all([
    check("auth",async()=>{await auth.listUsers(1);}),
    check("databaseRead",async()=>{await registry.get();}),
    check("databaseWrite",async()=>{
      const ref=getDatabase(app).ref("_testDiagnostics/"+randomUUID());
      try{
        await ref.set({testOnly:true});
        if((await ref.get()).val()?.testOnly!==true)throw Error("verification_failed");
      }finally{await ref.remove();}
    })
  ]);
  console.log("TEST_FIREBASE_CHECK "+JSON.stringify(readiness));
}
const ready=()=>Object.values(readiness).every(value=>value==="ok");
void verifyTestFirebase();
// Isolated, bounded read-only preview requests; no Firebase auth bypass on existing API routes.
let previewWindow=0,previewCount=0,previewJobs=0;
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/health"&&req.method==="GET")return reply(res,ready()?200:503,{ok:ready(),testOnly:true,registrationEnabled:registrationEnabled&&ready(),firebase:readiness});
    const publicToken=previewToken(url.pathname);
    if(publicToken&&["GET","HEAD"].includes(req.method)){
      let details=null;
      if(Date.now()>=previewWindow){previewWindow=Date.now()+60000;previewCount=0;}
      // A generic preview still leads to the original invitation if the API is busy.
      if(req.method==="GET"&&registrationEnabled&&ready()&&previewCount<120&&previewJobs<4){
        previewCount++;previewJobs++;
        try{details=previewDetails(await directRootRead(),cardKey,publicToken);}catch{}finally{previewJobs--;}
      }
      const page=previewPage(publicToken,details);
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow, noarchive","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; img-src "+ORIGIN+"; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
      return res.end(req.method==="HEAD"?undefined:page);
    }
    if(req.headers.origin!==ORIGIN)return reply(res,403,{error:"origin_not_allowed"});
    res.setHeader("Access-Control-Allow-Origin",ORIGIN);
    res.setHeader("Vary","Origin");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
    if(req.method==="OPTIONS"){res.writeHead(204);return res.end();}
    if(!registrationEnabled||!ready())return reply(res,503,{error:"test_registration_disabled"});
    const bearer=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||"");
    if(!bearer)return reply(res,401,{error:"authentication_required"});
    let user;
    try{user=await auth.verifyIdToken(bearer[1],true);}catch{return reply(res,401,{error:"invalid_token"});}
    const uid=user.uid;
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)||["__proto__","constructor","prototype"].includes(uid))return reply(res,403,{error:"unsupported_identity"});
    if(limited("user:"+uid,30))return reply(res,429,{error:"too_many_requests"});
    if(req.method==="GET"&&url.pathname==="/admin/chat/alerts"){
      if(uid!=="fma5bvfcCRYoS1kBf0CUFdBVowJ3"||user.firebase?.sign_in_provider!=="google.com")return reply(res,403,{error:"admin_required"});
      const rooms=adminAlertDirectory(await directRootRead());
      if(rooms.length)console.log("TEST_ADMIN_ALERT_READ "+JSON.stringify({rooms:rooms.length,total:rooms.reduce((n,r)=>n+r.count,0)}));
      return reply(res,200,{rooms});
    }
    if(url.pathname==="/chat"||url.pathname==="/admin/chat"){
      const admin=url.pathname==="/admin/chat";
      if(admin&&(uid!=="fma5bvfcCRYoS1kBf0CUFdBVowJ3"||user.firebase?.sign_in_provider!=="google.com"))return reply(res,403,{error:"admin_required"});
      if(req.method==="GET"){
        const view=chatView(await directRootRead(),{uid,admin,groupId:url.searchParams.get("groupId")});
        if(view.code)console.log("TEST_CHAT_READ "+JSON.stringify({status:403,error:view.code,admin}));
        return reply(res,view.code?403:200,view.code?{error:view.code}:view.result);
      }
      if(req.method==="POST"){
        if(limited("chat:"+uid,12))return reply(res,429,{error:"too_many_requests"});
        const b=await body(req),id=randomUUID(),now=Date.now();
        const action=admin?(b.action||"send"):["report","report_room"].includes(b.action)?b.action:"send";
        const result=await directRootChange(root=>chatAction(root,{uid,admin,groupId:b.groupId,text:b.text,id,now,action,targetUid:admin?b.targetUid:undefined,messageId:b.messageId,gameId:b.gameId,tour:b.tour}));
        if(action==="clear_room_alerts"&&result.status===200){
          const fresh=await directRootRead();
          const reports=fresh?.events?.miss2027?.chatReports?.[result.body.roomId]||{};
          const verified=result.body.clearedIds.every(key=>reports[key]?.status==="resolved");
          const rooms=adminAlertDirectory(fresh);
          console.log("TEST_CLEAR_ROOM_ALERTS "+JSON.stringify({verified,cleared:result.body.clearedIds.length,remaining:rooms.find(r=>r.id===result.body.roomId)?.count||0}));
          if(!verified)return reply(res,409,{error:"clear_alert_not_verified"});
          return reply(res,200,{...result.body,verified:true,rooms});
        }
        if(action==="vote_reminder"&&result.status===200){
          const fresh=await directRootRead();
          const message=fresh?.events?.miss2027?.chats?.[b.groupId]?.[result.body.messageId];
          const verified=message?.kind==="vote_reminder"&&message.targetUid===b.targetUid&&message.gameId===b.gameId&&message.tour===b.tour;
          console.log("TEST_VOTE_REMINDER "+JSON.stringify({verified,alreadySent:result.body.alreadySent===true}));
          if(!verified)return reply(res,409,{error:"reminder_not_verified"});
          return reply(res,200,{...result.body,verified:true});
        }
        if(action==="report_room"&&result.status===200){
          const receipt={uid,roomId:result.body.roomId,reportId:result.body.reportId};
          const fresh=await directRootRead(),verified=verifyRoomReport(fresh,receipt);
          const pending=adminAlertDirectory(fresh).find(r=>r.id===receipt.roomId)?.count||0;
          console.log("TEST_ROOM_REPORT "+JSON.stringify({verified,pending,alreadyReported:result.body.alreadyReported===true}));
          if(!verified)return reply(res,409,{error:"report_not_verified"});
          return reply(res,200,{...result.body,verified:true});
        }
        console.log("TEST_CHAT_WRITE "+JSON.stringify({action,status:result.status,error:result.body?.error,admin,accepted:result.body?.accepted===true}));
        return reply(res,result.status,result.body);
      }
      return reply(res,405,{error:"method_not_allowed"});
    }
    if(url.pathname==="/admin/game"||url.pathname==="/admin/round"||url.pathname==="/admin/finale"||url.pathname==="/admin/votes"||url.pathname==="/admin/connections"){
      if(uid!=="fma5bvfcCRYoS1kBf0CUFdBVowJ3"||user.firebase?.sign_in_provider!=="google.com")return reply(res,403,{error:"admin_required"});
      if(req.method==="GET"&&url.pathname==="/admin/game")return reply(res,200,adminGameView(await directRootRead()));
      if(req.method==="POST"&&["/admin/votes","/admin/connections"].includes(url.pathname)){
        const b=await body(req),kind=url.pathname.endsWith("/votes")?"votes":"connections";
        let before;
        const result=await directRootChange(root=>{
          before=registrationCounts(root);
          return protectedControlChange(root,r=>(kind==="votes"?setVoteOpening:setConnectionOpening)(r,{gameId:b.gameId,open:b.open}));
        });
        console.log("TEST_ADMIN_CONTROL "+JSON.stringify({kind,open:b.open===true,status:result.status,error:result.body?.error||null,before,after:result.status===200?registrationCounts(result.state):null}));
        return reply(res,result.status,result.body);
      }
      if(req.method==="POST"&&url.pathname==="/admin/finale"){
        const b=await body(req);
        if(b.confirmed!==true)return reply(res,400,{error:"confirmation_required"});
        const result=await directRootChange(root=>publishFinal(root,{gameId:b.gameId}));
        return reply(res,result.status,result.body);
      }
      if(req.method==="POST"&&url.pathname==="/admin/round"){
        const b=await body(req);
        const result=await directRootChange(root=>advanceRound(root,{gameId:b.gameId,tour:b.tour,selection:b.selection}));
        return reply(res,result.status,result.body);
      }
      return reply(res,405,{error:"method_not_allowed"});
    }
    if(req.method==="POST"&&url.pathname==="/admin/player/remove"){
      if(uid!=="fma5bvfcCRYoS1kBf0CUFdBVowJ3"||user.firebase?.sign_in_provider!=="google.com")return reply(res,403,{error:"admin_required"});
      if(limited("admin-remove:"+uid,10))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req),now=Date.now();
      const result=await directRootChange(root=>removePlayer(root,{targetUid:b.targetUid,groupId:b.groupId,gameId:b.gameId,confirmed:b.confirmed,now}));
      console.log("TEST_ADMIN_REMOVE "+JSON.stringify({status:result.status,error:result.body?.error||null,remaining:result.body?.remaining}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/admin/reset"){
      // Verify the same test administrator identity as Firebase RTDB rules.
      // Never trust a client role, a group password, or an email address.
      if(uid!=="fma5bvfcCRYoS1kBf0CUFdBVowJ3"||user.firebase?.sign_in_provider!=="google.com")return reply(res,403,{error:"admin_required"});
      if(limited("reset:"+uid,4))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      const word=b.kind==="game"?"JEU":b.kind==="registrations"?"INSCRIPTIONS":null;
      if(!word||b.confirmation!==word||b.confirmed!==true)return reply(res,400,{error:"invalid_reset"});
      const id=Date.now()+"-"+randomUUID();
      const result=await directReset(b.kind,id);
      console.log("TEST_ADMIN_RESET "+b.kind+" "+JSON.stringify(result.status===200?{verified:result.body.verified,before:result.body.before,remaining:result.body.remaining}:{error:result.body.error,reasons:result.body.reasons||[]}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/game/enter"){
      if(uid==="fma5bvfcCRYoS1kBf0CUFdBVowJ3")return reply(res,403,{error:"admin_cannot_register"});
      const now=Date.now();
      const result=await directRootChange(root=>enterGame(root,{uid,now}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="GET"&&url.pathname==="/game/state"){
      const view=gameView(await directRootRead(),uid);
      return reply(res,view.code?403:200,view.code?{error:view.code}:view.result);
    }
    if(req.method==="POST"&&url.pathname==="/game/vote"){
      if(limited("vote:"+uid,8))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req),now=Date.now();
      const result=await directRootChange(root=>castVote(root,{uid,gameId:b.gameId,tour:b.tour,selection:b.selection,favorite:b.favorite,now}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/groups/invite/preview"){
      const b=await body(req);
      if(!validInvite(b.token))return reply(res,400,{error:"unavailable"});
      const root=await directRootRead(),digest=digestInvite(b.token),view=invitationView(root,digest);
      if(view.code)return reply(res,403,{error:view.code});
      const group=root.events.miss2027.registration.groups[view.result.group.id];
      const card=group.inviteCard?.digest===digest?openInvitation(cardKey,group.inviteCard,{groupId:view.result.group.id,ownerUid:group.ownerUid}):null;
      return reply(res,200,{group:view.result.group,...(card?{password:card.password}:{})});
    }
    if(req.method==="POST"&&url.pathname==="/groups/invite/join"){
      if(uid==="fma5bvfcCRYoS1kBf0CUFdBVowJ3")return reply(res,403,{error:"admin_cannot_register"});
      const b=await body(req);
      if(!validInvite(b.token)||!validString(b.pseudo,1,24))return reply(res,400,{error:"invalid_fields"});
      const digest=digestInvite(b.token),now=Date.now();
      const result=await directRootChange(root=>acceptInvitation(root,{uid,digest,pseudo:b.pseudo.trim(),now}));
      return reply(res,result.status,result.body);
    }
    if(url.pathname==="/groups/owner/invitation"){
      if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"method_not_allowed"});
      let root=await directRootRead(),view=ownerView(root,uid);
      if(view.code)return reply(res,403,{error:view.code});
      if(view.result.group.locked)return reply(res,403,{error:"membership_locked"});
      if(!view.result.group.registrationsOpen)return reply(res,409,{error:"group_full"});
      const groupId=view.result.group.id;
      let group=root.events.miss2027.registration.groups[groupId];
      if(!group.inviteCard){
        if(req.method==="GET")return reply(res,200,{group:view.result.group,passwordRequired:true});
        if(limited("prepare-invite:"+uid,8))return reply(res,429,{error:"too_many_requests"});
        const b=await body(req);
        if(!validString(b.password,6,128)||!await matches(b.password,group.secret))return reply(res,403,{error:"invalid_password"});
        const card=sealInvitation(cardKey,{groupId,ownerUid:uid,password:b.password});
        const result=await directRootChange(state=>{
          const current=ownerView(state,uid);
          if(current.code||current.result.group.id!==groupId)return {code:"owner_required"};
          return manageGroup(state,{uid,action:"publish_invitation",verifiedSecret:group.secret,card});
        });
        if(result.status!==200)return reply(res,result.status,result.body);
        root=await directRootRead();view=ownerView(root,uid);
        if(view.code||view.result.group.id!==groupId)return reply(res,403,{error:"owner_required"});
        if(view.result.group.locked||!view.result.group.registrationsOpen)return reply(res,409,{error:"unavailable"});
        group=root.events.miss2027.registration.groups[groupId];
      }
      const card=openInvitation(cardKey,group.inviteCard,{groupId,ownerUid:uid});
      if(!card)return reply(res,409,{error:"invitation_unavailable"});
      return reply(res,200,{group:view.result.group,...card});
    }
    if(url.pathname==="/groups/owner/manage"){
      if(req.method==="GET"){
        const view=ownerView(await directRootRead(),uid);
        return reply(res,view.code?403:200,view.code?{error:view.code}:view.result);
      }
      if(req.method==="POST"){
        const b=await body(req);
        let verifiedSecret,reuse=false;
        if(b.action==="prepare_invite"){
          if(limited("prepare-invite:"+uid,8))return reply(res,429,{error:"too_many_requests"});
          const root=await directRootRead(),view=ownerView(root,uid);
          if(view.code)return reply(res,403,{error:view.code});
          const group=root.events.miss2027.registration.groups[view.result.group.id];
          if(!validString(b.password,6,128)||!await matches(b.password,group.secret))return reply(res,403,{error:"invalid_password"});
          verifiedSecret=group.secret;
          if(b.reuseToken!==undefined){if(!validInvite(b.reuseToken))return reply(res,400,{error:"invalid_fields"});reuse=true;}
        }
        const token=reuse?b.reuseToken:["invite","prepare_invite"].includes(b.action)?randomBytes(32).toString("hex"):null;
        const result=await directRootChange(root=>manageGroup(root,{uid,action:b.action,value:b.value,targetUid:b.targetUid,digest:token?digestInvite(token):undefined,verifiedSecret,reuse}));
        console.log("TEST_OWNER_ACTION "+JSON.stringify({action:["invite","prepare_invite","remove","revoke"].includes(b.action)?b.action:"invalid",status:result.status,error:result.body?.error||null}));
        return reply(res,result.status,result.status===200&&token?{...result.body,token}:result.body);
      }
      return reply(res,405,{error:"method_not_allowed"});
    }
    if(req.method==="POST"&&url.pathname==="/groups/recovery/login"){
      if(limited("recovery-login:"+uid,5))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validString(b.pseudo,1,24)||!validString(b.password,6,128))return reply(res,403,{error:"recovery_invalid"});
      const key=normalizePseudo(b.pseudo);
      if(limited("recovery-target:"+key,12))return reply(res,429,{error:"too_many_requests"});
      const view=await authenticateGroupMember({read:directRootRead,matches,requesterUid:uid,pseudo:b.pseudo,password:b.password,adminUid:"fma5bvfcCRYoS1kBf0CUFdBVowJ3"});
      if(view.code){console.log("TEST_ACCOUNT_LOGIN "+JSON.stringify({status:403,error:view.code}));return reply(res,403,{error:view.code});}
      const account=await auth.getUser(view.result.uid);
      if(account.disabled)return reply(res,403,{error:"recovery_invalid"});
      const token=await auth.createCustomToken(view.result.uid);
      console.log("TEST_ACCOUNT_LOGIN "+JSON.stringify({status:200}));
      return reply(res,200,{token,uid:view.result.uid});
    }
    if(req.method==="POST"&&url.pathname==="/groups/name"){
      const b=await body(req);
      if(!validString(b.name,1,80)||!normalizePseudo(b.name))return reply(res,400,{error:"invalid_fields"});
      const state=(await directRootRead())?.events?.miss2027?.registration;
      return reply(res,200,{available:groupNameAvailable(state,b.name)});
    }
    if(req.method==="POST"&&url.pathname==="/groups/pseudo"){
      const b=await body(req);
      if(!validString(b.pseudo,1,24)||!normalizePseudo(b.pseudo))return reply(res,400,{error:"invalid_fields"});
      const state=(await directRootRead())?.events?.miss2027?.registration;
      return reply(res,200,{available:pseudoAvailable(state,b.pseudo,b.creating===true?null:uid)});
    }
    if(req.method==="GET"&&url.pathname==="/groups/me"){
      const root=await directRootRead(),event=root?.events?.miss2027||{};
      const group=membershipView(event.registration,uid);
      const members=group?Object.entries(event.registration.groups[group.id].members||{}).map(([id,m])=>({...(group.isOwner?{id}:{}),pseudo:m.pseudo,isOwner:event.registration.groups[group.id].ownerUid===id})):[];
      return reply(res,200,{removed:isExcluded(event.registration,uid),group:group?{...group,entered:event.players?.[uid]?.groupId===group.id}:null,members,gameId:root?.rooms?.miss2027?.gameId?String(root.rooms.miss2027.gameId):null});
    }
    if(req.method==="POST"&&url.pathname==="/groups/public"){
      if(limited("public:"+uid,5))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validString(b.pseudo,1,24))return reply(res,400,{error:"invalid_fields"});
      if(uid==="fma5bvfcCRYoS1kBf0CUFdBVowJ3")return reply(res,403,{error:"admin_cannot_register"});
      const now=Date.now();
      const result=await directRootChange(root=>locked(root)&&!membershipView(root?.events?.miss2027?.registration,uid)?{code:"membership_locked"}:registerPublic(root,{uid,pseudo:b.pseudo.trim(),now}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="GET"&&url.pathname==="/groups/search"){
      const query=url.searchParams.get("q");
      if(!validString(query,1,80))return reply(res,400,{error:"invalid_query"});
      const state=(await directRootRead())?.events?.miss2027?.registration;
      return reply(res,200,{groups:searchGroups(state,query)});
    }
    if(req.method==="POST"&&url.pathname==="/groups/create"){
      if(uid==="fma5bvfcCRYoS1kBf0CUFdBVowJ3")return reply(res,403,{error:"admin_cannot_register"});
      if(limited("create:"+uid,3))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validString(b.name,1,80)||!validString(b.pseudo,1,24)||!validString(b.password,6,128))return reply(res,400,{error:"invalid_fields"});
      const epoch=(await directRootRead())?.events?.miss2027?.registration?.epoch||null;
      const id=randomUUID(),secret=await hash(b.password),now=Date.now();
      const inviteCard=sealInvitation(cardKey,{groupId:id,ownerUid:uid,password:b.password});
      const result=await directRootChange(root=>registrationChange(root,s=>(s?.epoch||null)!==epoch?{code:"registration_reset"}:createGroup(s,{uid,id,name:b.name.trim(),pseudo:b.pseudo.trim(),secret,now,inviteCard})));
      if(result.status!==200){
        console.log("TEST_GROUP_CREATE "+JSON.stringify({status:result.status,error:result.body?.error||null}));
        return reply(res,result.status,result.body);
      }
      const view=ownerView(await directRootRead(),uid);
      if(view.code||view.result.group.id!==id){
        console.log("TEST_GROUP_CREATE "+JSON.stringify({status:409,error:"creation_not_verified"}));
        return reply(res,409,{error:"creation_not_verified"});
      }
      console.log("TEST_GROUP_CREATE "+JSON.stringify({status:200,verified:true}));
      return reply(res,200,{...result.body,group:view.result.group});
    }
    if(req.method==="POST"&&url.pathname==="/groups/join"){
      if(limited("join:"+uid,5))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validId(b.id)||!validString(b.pseudo,1,24)||!validString(b.password,6,128))return reply(res,400,{error:"invalid_fields"});
      if(limited("group:"+b.id,30))return reply(res,429,{error:"too_many_requests"});
      const group=(await directRootRead())?.events?.miss2027?.registration?.groups?.[b.id];
      if(!group||group.type==="public"||!await matches(b.password,group.secret))return reply(res,403,{error:"group_or_password_invalid"});
      const now=Date.now();
      const result=await directRootChange(root=>registrationChange(root,s=>joinGroup(s,{uid,id:b.id,pseudo:b.pseudo.trim(),verifiedSecret:group.secret,now})));
      return reply(res,result.status,result.body);
    }
    return reply(res,404,{error:"not_found"});
  } catch(e){
    // Never log credentials, input payloads or tokens.
    if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:"internal_error"});
    else res.end();
  }
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.listen(Number(process.env.PORT||3000),"0.0.0.0");

}
