import {membershipView} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const store=(root,event)=>({...root,events:{...root.events,miss2027:event}});
const member=(event,uid)=>membershipView(event.registration,uid);
const safeKey=k=>typeof k==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(k)&&!["__proto__","constructor","prototype"].includes(k);
const rows=(event,id)=>Object.values(event.chats?.[id]||{}).sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id));
export function chatView(root,{uid,admin=false,groupId}){
 const event=eventOf(root),group=member(event,uid);
 const id=admin?groupId:group?.id;
 if(!safeKey(id)||!event.registration?.groups?.[id])return fail("not_registered");
 if(!admin&&event.players?.[uid]?.groupId!==id)return fail("not_registered");
 return {result:{messages:rows(event,id).filter(m=>admin||!m.targetUid||m.targetUid===uid).slice(-80).map(({targetUid,...m})=>m),blocked:!admin&&event.chatModeration?.[uid]===true}};
}
export function chatAction(root,{uid,admin=false,groupId,text,id,now,action="send",targetUid}){
 const event=eventOf(root),group=member(event,uid);
 const roomId=admin?groupId:group?.id;
 if(!safeKey(roomId)||!event.registration?.groups?.[roomId])return fail("not_registered");
 if(!admin&&event.players?.[uid]?.groupId!==roomId)return fail("not_registered");
 if(!["send","warn","block","unblock"].includes(action))return fail("invalid_action");
 if(action!=="send"&&(!admin||!safeKey(targetUid)||member(event,targetUid)?.id!==roomId))return fail("admin_required");
 if(action==="block"||action==="unblock"){
   return {state:store(root,{...event,chatModeration:{...event.chatModeration,[targetUid]:action==="block"}}),result:{accepted:true}};
 }
 if(!admin&&event.chatModeration?.[uid]===true)return fail("chat_blocked");
 const message=action==="warn"?member(event,targetUid).pseudo+" tu dépasses les limites, dernier avertissement !!!":typeof text==="string"?text.trim():"";
 if(!message||message.length>500||!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
 const existing=event.chats?.[roomId]||{};
 if(existing[id])return fail("conflict");
 const row={id,author:admin?"ADMIN":group.pseudo,uid,admin,date:now,text:message,...(action==="warn"?{targetUid}:{})};
 const retained=[...Object.values(existing),row].sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id)).slice(-120);
 const chats={...event.chats,[roomId]:Object.fromEntries(retained.map(m=>[m.id,m]))};
 return {state:store(root,{...event,chats}),result:{accepted:true}};
}
