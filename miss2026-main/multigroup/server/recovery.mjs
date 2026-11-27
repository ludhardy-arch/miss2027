import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import {membershipView,normalizePseudo} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const normalizeCode=code=>typeof code==="string"?code.replace(/[\s-]/g,"").toLowerCase():"";
export const newRecoveryCode=()=>randomBytes(16).toString("hex").match(/.{4}/g).join("-");
const digest=code=>createHash("sha256").update(code).digest("hex");
export function issueRecovery(root,{uid,code,rotate=false}){
 const event=eventOf(root),reg=event.registration,group=membershipView(reg,uid);
 if(!group)return fail("not_registered");
 const normalized=normalizeCode(code);
 if(!/^[a-f0-9]{32}$/.test(normalized))return fail("invalid_fields");
 const g=reg.groups[group.id],m=g.members[uid];
 if(m.recoveryDigest&&!rotate)return {state:root,result:{recoveryConfigured:true}};
 const next={...g,members:{...g.members,[uid]:{...m,recoveryDigest:digest(normalized)}}};
 return {state:{...root,events:{...root.events,miss2027:{...event,registration:{...reg,groups:{...reg.groups,[group.id]:next}}}}},result:{recoveryConfigured:true,recoveryCode:code}};
}
export function withRecovery(outcome,uid,code){
 if(outcome.code)return outcome;
 const issued=issueRecovery(outcome.state,{uid,code});
 if(issued.code)return issued;
 return {state:issued.state,result:{...outcome.result,...issued.result}};
}
export function recoveryIdentity(root,{requesterUid,pseudo,code,adminUid}){
 const reg=eventOf(root).registration,key=normalizePseudo(pseudo),normalized=normalizeCode(code);
 if(!key||!/^([a-f0-9]{32})$/.test(normalized)||requesterUid===adminUid)return fail("recovery_invalid");
 const requested=digest(normalized);
 let target=null;
 for(const [id,g] of Object.entries(reg?.groups||{})){
  for(const [uid,m] of Object.entries(g.members||{})){
   if(uid===adminUid||reg.membership?.[uid]!==id||normalizePseudo(m.pseudo)!==key||!(/^[a-f0-9]{64}$/.test(m.recoveryDigest||"")))continue;
   if(timingSafeEqual(Buffer.from(requested,"hex"),Buffer.from(m.recoveryDigest,"hex")))target=uid;
  }
 }
 if(!target)return fail("recovery_invalid");
 if(membershipView(reg,requesterUid)&&target!==requesterUid)return fail("already_member");
 return {result:{uid:target}};
}
