import http from "node:http";
import {randomBytes,randomUUID,scrypt,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {initializeApp,cert} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {createGroup,joinGroup,searchGroups} from "./registration.mjs";

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
const registry=getDatabase(app).ref("events/miss2027/registration");
const derive=promisify(scrypt);
const validString=(v,min,max)=>typeof v==="string"&&v.trim().length>=min&&v.length<=max;
const validId=v=>typeof v==="string"&&/^[a-f0-9-]{36}$/.test(v);
const rate=new Map();
const globalRate={count:0,until:0};
let cryptoJobs=0;
function limited(key,max,period=60000) {
  const now=Date.now();
  if(globalRate.until<=now){globalRate.count=0;globalRate.until=now+60000;}
  if(++globalRate.count>300)return true;
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
async function atomic(operation){
  let outcome;
  const tx=await registry.transaction(current=>{
    outcome=operation(current);
    // A first local snapshot can be null even when remote data exists. A no-op
    // allows the server to detect conflicts and retry, without deleting state.
    return outcome.state===undefined?current:outcome.state;
  },undefined,false);
  if(!tx.committed||outcome?.code)return {status:409,body:{error:outcome?.code||"conflict"}};
  return {status:200,body:outcome.result};
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
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/health"&&req.method==="GET")return reply(res,ready()?200:503,{ok:ready(),testOnly:true,registrationEnabled:registrationEnabled&&ready(),firebase:readiness});
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
    if(req.method==="GET"&&url.pathname==="/groups/me"){
      const state=(await registry.get()).val();
      const id=state?.membership?.[uid];
      const group=id&&state.groups?.[id];
      const member=group?.members?.[uid];
      if(!group||!member)return reply(res,200,{group:null});
      return reply(res,200,{group:{id,name:group.name,pseudo:member.pseudo,isOwner:group.ownerUid===uid,memberCount:Object.keys(group.members).length}});
    }
    if(req.method==="GET"&&url.pathname==="/groups/search"){
      const query=url.searchParams.get("q");
      if(!validString(query,1,80))return reply(res,400,{error:"invalid_query"});
      const snap=await registry.get();
      return reply(res,200,{groups:searchGroups(snap.val(),query)});
    }
    if(req.method==="POST"&&url.pathname==="/groups/create"){
      if(!user.email||!user.email_verified)return reply(res,403,{error:"verified_email_required"});
      if(limited("create:"+uid,3))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validString(b.name,1,80)||!validString(b.pseudo,1,24)||!validString(b.password,6,128))return reply(res,400,{error:"invalid_fields"});
      const id=randomUUID(),secret=await hash(b.password),now=Date.now();
      const result=await atomic(s=>createGroup(s,{uid,id,name:b.name.trim(),pseudo:b.pseudo.trim(),secret,now}));
      return reply(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/groups/join"){
      if(limited("join:"+uid,5))return reply(res,429,{error:"too_many_requests"});
      const b=await body(req);
      if(!validId(b.id)||!validString(b.pseudo,1,24)||!validString(b.password,6,128))return reply(res,400,{error:"invalid_fields"});
      if(limited("group:"+b.id,30))return reply(res,429,{error:"too_many_requests"});
      const group=(await registry.child("groups").child(b.id).get()).val();
      if(!group||!group.registrationsOpen||!await matches(b.password,group.secret))return reply(res,403,{error:"group_or_password_invalid"});
      const now=Date.now();
      const result=await atomic(s=>joinGroup(s,{uid,id:b.id,pseudo:b.pseudo.trim(),verifiedSecret:group.secret,now}));
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
