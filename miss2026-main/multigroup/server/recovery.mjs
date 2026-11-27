import {membershipView,normalizePseudo,isExcluded} from "./registration.mjs";
const fail=code=>({code});
// Shared group password is deliberately the only recovery credential in this
// test workflow. Never use it for national admin or public-room identities.
export function recoveryCandidate(root,{requesterUid,pseudo,adminUid}){
 const reg=root?.events?.miss2027?.registration,key=normalizePseudo(pseudo);
 if(isExcluded(reg,requesterUid))return fail("player_removed");
 if(!key||requesterUid===adminUid)return fail("recovery_invalid");
 let target=null;
 for(const [id,g] of Object.entries(reg?.groups||{})){
  if(g.type!=="private"||typeof g.secret!=="string")continue;
  for(const [uid,m] of Object.entries(g.members||{})){
   if(uid===adminUid||reg.membership?.[uid]!==id||normalizePseudo(m.pseudo)!==key)continue;
   if(target)return fail("recovery_invalid");
   target={uid,id,secret:g.secret};
  }
 }
 if(!target)return fail("recovery_invalid");
 if(membershipView(reg,requesterUid)&&target.uid!==requesterUid)return fail("already_member");
 return {result:target};
}
export async function authenticateGroupMember({read,matches,requesterUid,pseudo,password,adminUid}){
 const args={requesterUid,pseudo,adminUid};
 const initial=recoveryCandidate(await read(),args);
 if(initial.code==="already_member"||initial.code==="player_removed")return initial;
 // Perform password verification even for unknown pseudonyms using a dummy hash.
 const candidate=initial.result;
 const valid=await matches(password,candidate?.secret||"0".repeat(32)+":"+"0".repeat(128));
 if(!candidate||!valid)return fail("recovery_invalid");
 const fresh=recoveryCandidate(await read(),args);
 if(fresh.code||fresh.result.uid!==candidate.uid||fresh.result.id!==candidate.id||fresh.result.secret!==candidate.secret)return fail("recovery_invalid");
 return {result:{uid:candidate.uid}};
}
