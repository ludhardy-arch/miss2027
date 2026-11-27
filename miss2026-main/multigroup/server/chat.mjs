import {membershipView} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const store=(root,event)=>({...root,events:{...root.events,miss2027:event}});
const member=(event,uid)=>membershipView(event.registration,uid);
const safeKey=k=>typeof k==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(k)&&!["__proto__","constructor","prototype"].includes(k);
const rows=(event,id)=>Object.values(event.chats?.[id]||{}).sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id));
const reportsOf=(event,id)=>event.chatReports?.[id]||{};
const pendingReports=(event,id)=>Object.values(reportsOf(event,id)).filter(r=>r.status==="pending");
export function adminChatSummary(root){
 const event=eventOf(root);
 return Object.fromEntries(Object.keys(event.registration?.groups||{}).map(id=>[id,{
  alerts:pendingReports(event,id).length,
  messages:rows(event,id).slice(-80).map(({id,date,uid})=>({id,date,uid}))
 }]));
}
export function chatView(root,{uid,admin=false,groupId}){
 const event=eventOf(root),group=member(event,uid);
 const id=admin?groupId:group?.id;
 if(!safeKey(id)||!event.registration?.groups?.[id])return fail("not_registered");
 const reports=reportsOf(event,id);
 return {result:{messages:rows(event,id).filter(m=>admin||!m.targetUid||m.targetUid===uid).slice(-80).map(({targetUid,...m})=>({...m,reported:!!reports[m.id]?.reporters?.[uid]})),blocked:!admin&&event.chatModeration?.[uid]===true,...(admin?{reports:pendingReports(event,id).map(({reporters,...r})=>({...r,count:Object.keys(reporters||{}).length})).sort((a,b)=>a.createdAt-b.createdAt)}:{})}};
}
export function chatAction(root,{uid,admin=false,groupId,text,id,now,action="send",targetUid,messageId}){
 const event=eventOf(root),group=member(event,uid);
 const roomId=admin?groupId:group?.id;
 if(!safeKey(roomId)||!event.registration?.groups?.[roomId])return fail("not_registered");
 if(!["send","warn","block","unblock","report","report_room","resolve_report"].includes(action))return fail("invalid_action");
 // A room alert is independent of any specific message or accused player.
 if(action==="report_room"){
  if(!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
  const reports=reportsOf(event,roomId);
  const prior=Object.values(reports).find(r=>r.roomReport===true&&r.status==="pending");
  if(prior?.reporters?.[uid])return {state:root,result:{accepted:true,alreadyReported:true}};
  const key=prior?.messageId||id;
  if(!prior&&Object.hasOwn(reports,key))return fail("conflict");
  // Preserve public conversation context even when old messages roll out of the chat.
  // Do not include private warnings in the room-wide snapshot.
  const context=rows(event,roomId).filter(m=>!m.targetUid).slice(-20).map(({author,text,date})=>({author,text,date}));
  const report={...(prior||{messageId:key,roomReport:true,createdAt:now,status:"pending",context}),reporters:{...prior?.reporters,[uid]:true}};
  return {state:store(root,{...event,chatReports:{...event.chatReports,[roomId]:{...reports,[key]:report}}}),result:{accepted:true}};
 }
 if(action==="report"||action==="resolve_report"){
  if(!safeKey(messageId))return fail("invalid_message");
  const reports=reportsOf(event,roomId),prior=reports[messageId];
  if(action==="resolve_report"){
   if(!admin)return fail("admin_required");
   if(!prior)return fail("invalid_message");
   if(prior.status==="resolved")return {state:root,result:{accepted:true}};
   return {state:store(root,{...event,chatReports:{...event.chatReports,[roomId]:{...reports,[messageId]:{...prior,status:"resolved",resolvedAt:now}}}}),result:{accepted:true}};
  }
  const message=event.chats?.[roomId]?.[messageId];
  if(!message||message.uid===uid||(!admin&&message.targetUid&&message.targetUid!==uid))return fail("invalid_message");
  if(prior?.reporters?.[uid]||prior?.status==="resolved")return {state:root,result:{accepted:true,alreadyReported:true}};
  const report={...(prior||{messageId,author:message.author,targetUid:message.uid,text:message.text,date:message.date,createdAt:now,status:"pending"}),reporters:{...prior?.reporters,[uid]:true}};
  return {state:store(root,{...event,chatReports:{...event.chatReports,[roomId]:{...reports,[messageId]:report}}}),result:{accepted:true}};
 }
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
