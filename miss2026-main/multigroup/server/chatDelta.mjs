import {createHash} from "node:crypto";
const hash=messages=>createHash("sha256").update(JSON.stringify(messages)).digest("hex");
export function chatDelta(view,{first,last,digest}={}){
 const messages=view.messages||[];
 const cursor={first:messages[0]?.id||"",last:messages.at(-1)?.id||"",digest:hash(messages)};
 if(typeof digest!=="string"||!/^[a-f0-9]{64}$/.test(digest))return {...view,cursor};
 if(first===""&&last===""&&digest===hash([]))return {...view,cursor,delta:true};
 if(typeof first!=="string"||typeof last!=="string")return {...view,cursor};
 const start=messages.findIndex(m=>m.id===first),end=messages.findIndex(m=>m.id===last);
 // A matching prefix is sufficient to prove that the client's old snapshot
 // is identical. Eviction, moderation or changed reports fall back to full.
 if(start!==0||end<start||hash(messages.slice(0,end+1))!==digest)return {...view,cursor};
 return {...view,messages:messages.slice(end+1),cursor,delta:true};
}
