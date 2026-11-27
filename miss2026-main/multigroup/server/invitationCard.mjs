import {createHash,createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export const invitationKey=secret=>createHash("sha256").update("miss2027-test/invitation-card/v1\0").update(secret).digest();
export const invitationDigest=token=>createHash("sha256").update(token).digest("hex");
const aad=(groupId,ownerUid)=>Buffer.from(JSON.stringify([groupId,ownerUid]),"utf8");
export function sealInvitation(key,{groupId,ownerUid,password}){
 const token=randomBytes(32).toString("hex"),iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(aad(groupId,ownerUid));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({token,password}),"utf8"),cipher.final()]);
 return {digest:invitationDigest(token),iv:iv.toString("hex"),tag:cipher.getAuthTag().toString("hex"),data:encrypted.toString("base64")};
}
export function openInvitation(key,card,{groupId,ownerUid}){
 if(!card)return null;
 try{
  const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(card.iv,"hex"));decipher.setAAD(aad(groupId,ownerUid));decipher.setAuthTag(Buffer.from(card.tag,"hex"));
  const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(card.data,"base64")),decipher.final()]).toString("utf8"));
  if(typeof value.password!=="string"||!/^([a-f0-9]{64})$/.test(value.token)||invitationDigest(value.token)!==card.digest)return null;
  return value;
 }catch{return null;}
}
