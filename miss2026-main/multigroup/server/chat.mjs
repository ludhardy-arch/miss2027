import {membershipView,isExcluded} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const store=(root,event)=>({...root,events:{...root.events,miss2027:event}});
const member=(event,uid,groupId)=>membershipView(event.registration,uid,groupId);
const safeKey=k=>typeof k==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(k)&&!["__proto__","constructor","prototype"].includes(k);
const hasVoted=(event,uid,tour)=>Object.keys(event.votes?.[uid]?.["tour"+tour]||{}).length>0;
const rows=(event,id)=>Object.values(event.chats?.[id]||{}).sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id));
const reportsOf=(event,id)=>event.chatReports?.[id]||{};
const pendingReports=(event,id)=>Object.values(reportsOf(event,id)).filter(r=>r.status==="pending");
export function adminAlertDirectory(root){
 const event=eventOf(root);
 return Object.entries(event.registration?.groups||{}).map(([id,g])=>({id,name:g.name,count:pendingReports(event,id).length})).filter(g=>g.count>0).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
}
export function verifyRoomReport(root,{uid,roomId,reportId}){
 if(!safeKey(roomId)||!safeKey(reportId))return false;
 const report=reportsOf(eventOf(root),roomId)[reportId];
 return report?.roomReport===true&&report.reporters?.[uid]===true;
}
export function adminChatSummary(root){
 const event=eventOf(root);
 return Object.fromEntries(Object.keys(event.registration?.groups||{}).map(id=>[id,{
  alerts:pendingReports(event,id).length,
  messages:rows(event,id).slice(-80).map(({id,date,uid})=>({id,date,uid}))
 }]));
}
export function chatView(root,{uid,admin=false,groupId}){
 const event=eventOf(root),group=member(event,uid,admin?undefined:groupId);
 const id=admin?groupId:group?.id;
 if(!safeKey(id)||!event.registration?.groups?.[id])return fail("not_registered");
 const reports=reportsOf(event,id),room=root?.rooms?.miss2027;
 const reminder=!admin&&room?.votesOpen===true&&!room.finaleStarted&&!hasVoted(event,uid,Number(room.tour||1))?rows(event,id).filter(m=>m.kind==="vote_reminder"&&m.targetUid===uid&&m.gameId===String(room.gameId)&&m.tour===Number(room.tour||1)).at(-1):null;
 return {result:{voteReminder:reminder?{id:reminder.id,text:reminder.text}:null,messages:rows(event,id).filter(m=>admin||!m.targetUid||m.targetUid===uid).slice(-80).map(({targetUid,...m})=>({...m,reported:!!reports[m.id]?.reporters?.[uid]})),blocked:!admin&&event.chatModeration?.[uid]===true,...(admin?{reports:pendingReports(event,id).map(({reporters,...r})=>({...r,count:Object.keys(reporters||{}).length})).sort((a,b)=>a.createdAt-b.createdAt)}:{})}};
}
export function chatAction(root,{uid,admin=false,groupId,text,id,now,action="send",targetUid,messageId,gameId,tour}){
 const event=eventOf(root),group=member(event,uid,admin?undefined:groupId);
 const roomId=admin?groupId:group?.id;
 if(!safeKey(roomId)||!event.registration?.groups?.[roomId])return fail("not_registered");
 if(!["send","warn","block","unblock","report","report_room","resolve_report","clear_room_alerts","vote_reminder"].includes(action))return fail("invalid_action");
 // Clear only the selected room's pending alerts, never its messages or sanctions.
 if(action==="clear_room_alerts"){
  if(!admin)return fail("admin_required");
  if(!Number.isFinite(now))return fail("invalid_message");
  const reports=reportsOf(event,roomId),clearedIds=Object.entries(reports).filter(([,r])=>r.status==="pending").map(([key])=>key);
  if(!clearedIds.length)return {state:root,result:{accepted:true,roomId,clearedIds:[]}};
  const next=Object.fromEntries(Object.entries(reports).map(([key,r])=>[key,r.status==="pending"?{...r,status:"resolved",resolvedAt:now}:r]));
  return {state:store(root,{...event,chatReports:{...event.chatReports,[roomId]:next}}),result:{accepted:true,roomId,clearedIds}};
 }
 // A room alert is independent of any specific message or accused player.
 if(action==="report_room"){
  if(!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
  const reports=reportsOf(event,roomId);
  const prior=Object.values(reports).find(r=>r.roomReport===true&&r.status==="pending");
  if(prior?.reporters?.[uid])return {state:root,result:{accepted:true,alreadyReported:true,roomId,reportId:prior.messageId}};
  const key=prior?.messageId||id;
  if(!prior&&Object.hasOwn(reports,key))return fail("conflict");
  // Preserve public conversation context even when old messages roll out of the chat.
  // Do not include private warnings in the room-wide snapshot.
  const context=rows(event,roomId).filter(m=>!m.targetUid).slice(-20).map(({author,text,date})=>({author,text,date}));
  const report={...(prior||{messageId:key,roomReport:true,createdAt:now,status:"pending",context}),reporters:{...prior?.reporters,[uid]:true}};
  return {state:store(root,{...event,chatReports:{...event.chatReports,[roomId]:{...reports,[key]:report}}}),result:{accepted:true,roomId,reportId:key}};
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
 if(action!=="send"&&(!admin||!safeKey(targetUid)||member(event,targetUid,roomId)?.id!==roomId))return fail("admin_required");
 if(action==="vote_reminder"){
  const room=root?.rooms?.miss2027;
  if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
  if(Number(room.tour||1)!==tour)return fail("round_changed");
  if(room.votesOpen!==true||room.finaleStarted===true)return fail("votes_closed");
  if(hasVoted(event,targetUid,tour))return fail("already_voted");
  if(!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
  const previous=rows(event,roomId).filter(m=>m.kind==="vote_reminder"&&m.targetUid===targetUid&&m.gameId===gameId&&m.tour===tour).at(-1);
  if(previous&&now-previous.date<60000)return {state:root,result:{accepted:true,alreadySent:true,messageId:previous.id}};
  const row={id,author:"ADMIN",uid,admin:true,date:now,text:"Merci de valider votre vote !",targetUid,kind:"vote_reminder",gameId,tour};
  const existing=event.chats?.[roomId]||{};
  if(Object.hasOwn(existing,id))return fail("conflict");
  const retained=[...Object.values(existing),row].sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id)).slice(-120);
  return {state:store(root,{...event,chats:{...event.chats,[roomId]:Object.fromEntries(retained.map(m=>[m.id,m]))}}),result:{accepted:true,messageId:id}};
 }
 if(action==="block"||action==="unblock"){
   return {state:store(root,{...event,chatModeration:{...event.chatModeration,[targetUid]:action==="block"}}),result:{accepted:true}};
 }
 if(!admin&&event.chatModeration?.[uid]===true)return fail("chat_blocked");
 const message=action==="warn"?member(event,targetUid,roomId).pseudo+" tu dépasses les limites, dernier avertissement !!!":typeof text==="string"?text.trim():"";
 if(!message||message.length>500||!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
 const existing=event.chats?.[roomId]||{};
 if(existing[id])return fail("conflict");
 const row={id,author:admin?"ADMIN":group.pseudo,uid,admin,date:now,text:message,...(action==="warn"?{targetUid}:{})};
 const retained=[...Object.values(existing),row].sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id)).slice(-120);
 const chats={...event.chats,[roomId]:Object.fromEntries(retained.map(m=>[m.id,m]))};
 return {state:store(root,{...event,chats}),result:{accepted:true}};
}

// One atomic broadcast, one private message per unique registered player.
// Use their primary room so the existing in-app reminder works without duplication.
export function remindNonVoters(root,{uid,admin=false,gameId,tour,id,now}){
 const event=eventOf(root),room=root?.rooms?.miss2027;
 if(!admin)return fail("admin_required");
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(Number(room.tour||1)!==tour)return fail("round_changed");
 if(room.votesOpen!==true||room.finaleStarted===true)return fail("votes_closed");
 if(!safeKey(id)||!Number.isFinite(now))return fail("invalid_message");
 const recent=new Set();
 for(const messages of Object.values(event.chats||{})){
  for(const m of Object.values(messages||{}))if(m.kind==="vote_reminder"&&m.gameId===gameId&&m.tour===tour&&now-m.date<60000)recent.add(m.targetUid);
 }
 const additions=new Map(),receipts=[];
 let skipped=0,eligible=0;
 for(const targetUid of Object.keys(event.registration?.membership||{})){
  const group=member(event,targetUid);
  if(!group||isExcluded(event.registration,targetUid)||hasVoted(event,targetUid,tour))continue;
  eligible++;
  if(recent.has(targetUid)){skipped++;continue;}
  const key=id+"-"+receipts.length;
  const row={id:key,author:"ADMIN",uid,admin:true,date:now,text:"Merci de valider votre vote !",targetUid,kind:"vote_reminder",gameId,tour};
  if(Object.hasOwn(event.chats?.[group.id]||{},key))return fail("conflict");
  if(!additions.has(group.id))additions.set(group.id,[]);
  additions.get(group.id).push(row);receipts.push({roomId:group.id,messageId:key,targetUid});
 }
 const chats={...event.chats};
 for(const [roomId,rowsToAdd] of additions){
  // Keep all newly sent reminders even if many messages share the same timestamp.
  const retained=rows(event,roomId).slice(-(120-rowsToAdd.length)).concat(rowsToAdd);
  chats[roomId]=Object.fromEntries(retained.map(m=>[m.id,m]));
 }
 return {state:receipts.length?store(root,{...event,chats}):root,result:{accepted:true,sent:receipts.length,skipped,eligible,receipts}};
}
export function verifyNonVoterReminders(root,receipts,gameId,tour){
 return receipts.every(({roomId,messageId,targetUid})=>{
  const m=eventOf(root).chats?.[roomId]?.[messageId];
  return m?.kind==="vote_reminder"&&m.targetUid===targetUid&&m.gameId===gameId&&m.tour===tour;
 });
}
