import {membershipView,membershipIds,normalizePseudo,isExcluded} from "./registration.mjs";
const fail=code=>({code});
// Shared group password is deliberately the only recovery credential in this
// test workflow. Never use it for national admin or public-room identities.
export function recoveryCandidate(root,{requesterUid,pseudo,adminUid}){
 const reg=root?.events?.miss2027?.registration,key=normalizePseudo(pseudo);
 if(isExcluded(reg,requesterUid))return fail("player_removed");
 if(!key||requesterUid===adminUid)return fail("recovery_invalid");
 const targets=[];
 for(const [id,g] of Object.entries(reg?.groups||{})){
  if(g.type!=="private"||typeof g.secret!=="string")continue;
  for(const [uid,m] of Object.entries(g.members||{})){
   if(uid===adminUid||!membershipIds(reg,uid).includes(id)||normalizePseudo(m.pseudo)!==key)continue;
   targets.push({uid,id,secret:g.secret});
  }
 }
 if(!targets.length||targets.length>3||new Set(targets.map(t=>t.uid)).size!==1)return fail("recovery_invalid");
 if(membershipView(reg,requesterUid)&&targets[0].uid!==requesterUid)return fail("already_member");
 return {result:targets[0],candidates:targets};
}
export async function authenticateGroupMember({read,matches,requesterUid,pseudo,password,adminUid}){
 const args={requesterUid,pseudo,adminUid};
 const initial=recoveryCandidate(await read(),args);
 if(initial.code==="already_member"||initial.code==="player_removed")return initial;
 // Perform password verification even for unknown pseudonyms using a dummy hash.
 let candidate=null;
 for(const c of initial.candidates||[{secret:"0".repeat(32)+":"+"0".repeat(128)}]){
   if(await matches(password,c.secret)&&c.uid){candidate=c;break;}
 }
 if(!candidate)return fail("recovery_invalid");
 const fresh=recoveryCandidate(await read(),args);
 if(fresh.code||!fresh.candidates.some(c=>c.uid===candidate.uid&&c.id===candidate.id&&c.secret===candidate.secret))return fail("recovery_invalid");
 return {result:{uid:candidate.uid}};
}
