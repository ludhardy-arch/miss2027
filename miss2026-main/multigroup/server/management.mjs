import {membershipView,membershipViews,membershipIds,membershipIndex,joinGroup,normalizePseudo,isExcluded} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const replace=(root,event)=>({...root,events:{...root.events,miss2027:event}});
export function locked(root){
 const room=root?.rooms?.miss2027,event=eventOf(root);
 return room?.registrationLocked===true||room?.votesOpen===true||room?.finaleStarted===true||Number(room?.tour||1)!==1||Object.keys(event.votes||{}).length>0;
}
export function ownerView(root,uid,groupId){
 const event=eventOf(root),reg=event.registration,view=groupId?membershipView(reg,uid,groupId):membershipViews(reg,uid).find(g=>g.isOwner);
 if(!view?.isOwner)return fail("owner_required");
 const group=reg.groups[view.id];
 return {result:{group:{...view,entered:membershipIds(reg,uid).includes(event.players?.[uid]?.groupId),registrationsOpen:!locked(root)&&Object.keys(group.members||{}).length<30,locked:locked(root),invitationActive:!!(group.inviteDigest||group.inviteCard?.digest),members:Object.entries(group.members).map(([id,m])=>({id,pseudo:m.pseudo,isOwner:id===uid}))}}};
}
export function manageGroup(root,{uid,groupId,action,value,targetUid,digest,verifiedSecret,reuse=false,card}){
 const initial=ownerView(root,uid,groupId);
 if(initial.code)return initial;
 const event=eventOf(root),reg=event.registration,id=initial.result.group.id,g=reg.groups[id];
 if(locked(root)&&action!=="revoke")return fail("membership_locked");
 let group={...g},membership=reg.membership,players=event.players;
 if(action==="publish_invitation"){
   if(!initial.result.group.registrationsOpen)return fail("group_full");
   if(typeof verifiedSecret!=="string"||g.secret!==verifiedSecret)return fail("invalid_password");
   if(g.inviteCard)return {state:root,result:initial.result};
   if(!card||!/^[a-f0-9]{64}$/.test(card.digest||""))return fail("invalid_fields");
   group.inviteCard=card;
 }else if(action==="invite"||action==="prepare_invite"){
   if(!/^[a-f0-9]{64}$/.test(digest||""))return fail("invalid_fields");
   if(action==="prepare_invite"){
     if(typeof verifiedSecret!=="string"||g.secret!==verifiedSecret)return fail("invalid_password");
     if(!initial.result.group.registrationsOpen)return fail("group_full");
     if(reuse)return g.inviteDigest===digest?{state:root,result:initial.result}:fail("invitation_changed");
   }
   group.inviteDigest=digest;
 }else if(action==="revoke"){delete group.inviteDigest;delete group.inviteCard;}
 else if(action==="remove"){
   if(typeof targetUid!=="string"||targetUid===uid||!Object.hasOwn(g.members,targetUid)||!membershipIds(reg,targetUid).includes(id))return fail("invalid_member");
   const members={...g.members};delete members[targetUid];group.members=members;
   const remaining=membershipIds(reg,targetUid).filter(g=>g!==id);
   membership=membershipIndex(reg,targetUid,remaining);
   players={...players};
   if(!remaining.length)delete players[targetUid];
   else if(players[targetUid]?.groupId===id)players[targetUid]={...players[targetUid],groupId:remaining[0]};
 }else return fail("invalid_action");
 const next=replace(root,{...event,players,registration:{...reg,membership,groups:{...reg.groups,[id]:group}}});
 return {state:next,result:ownerView(next,uid,id).result};
}
export function invitationView(root,digest){
 if(!/^[a-f0-9]{64}$/.test(digest||"")||locked(root))return fail("unavailable");
 const entry=Object.entries(eventOf(root).registration?.groups||{}).find(([,g])=>g.type==="private"&&(g.inviteDigest===digest||g.inviteCard?.digest===digest));
 if(!entry)return fail("unavailable");
 return {result:{group:{id:entry[0],name:entry[1].name}}};
}
export function acceptInvitation(root,{uid,digest,pseudo,now,additional=false}){
 const event=eventOf(root),reg=event.registration;
 if(isExcluded(reg,uid))return fail("player_removed");
 const existing=membershipView(reg,uid);
 if(existing&&!additional)return {state:root,result:{group:existing,alreadyRegistered:true}};
 const view=invitationView(root,digest);
 if(view.code)return view;
 const id=view.result.group.id;
 const joined=joinGroup(reg,{uid,id,pseudo,verifiedSecret:reg.groups[id].secret,now,additional});
 if(joined.code)return joined;
 const next=replace(root,{...event,registration:joined.state});
 return {state:next,result:{group:membershipView(joined.state,uid,id),alreadyRegistered:joined.result.alreadyRegistered===true}};
}

const safeUid=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)&&!["__proto__","constructor","prototype"].includes(v);
const omitKey=(obj,key)=>Object.fromEntries(Object.entries(obj||{}).filter(([k])=>k!==key));
// Regie-only exclusion, authorized at the API boundary. Never change published results.
export function removePlayer(root,{targetUid,groupId,gameId,confirmed,now}){
 const room=root?.rooms?.miss2027,event=eventOf(root),reg=event.registration;
 if(confirmed!==true)return fail("confirmation_required");
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(room.finaleStarted===true||event.results)return fail("game_finished");
 if(!safeUid(targetUid)||!safeUid(groupId))return fail("invalid_member");
 const view=membershipView(reg,targetUid,groupId);
 if(!view)return fail("invalid_member");
 const updated={...reg.groups};
 for(const id of membershipIds(reg,targetUid)){
 const original=reg.groups[id],members=omitKey(original.members,targetUid);
 const group={...original,members};
 // Keep the group and chat. If its creator is removed, the oldest remaining
 // member becomes organizer. An empty private group has no owner until joined.
 if(original.ownerUid===targetUid){
   const next=Object.entries(members).sort(([a,x],[b,y])=>(Number(x.joinedAt)||0)-(Number(y.joinedAt)||0)||a.localeCompare(b))[0];
   if(next)group.ownerUid=next[0];else delete group.ownerUid;
   delete group.inviteDigest;delete group.inviteCard;
 }
 updated[id]=group;
 }
 const registration={...reg,groups:updated,membership:omitKey(reg.membership,targetUid),excluded:{...reg.excluded,[targetUid]:{pseudo:normalizePseudo(view.pseudo),at:now}}};
 const next=replace(root,{...event,registration,players:omitKey(event.players,targetUid),votes:omitKey(event.votes,targetUid),chatModeration:omitKey(event.chatModeration,targetUid)});
 return {state:next,result:{accepted:true,removedUid:targetUid,groupId,remaining:Object.keys(updated[groupId].members).length}};
}

export function deleteGroup(root,{groupId,gameId,confirmation,confirmed}){
 const room=root?.rooms?.miss2027,event=eventOf(root),reg=event.registration;
 if(confirmed!==true||confirmation!=="SUPPRIMER")return fail("confirmation_required");
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(locked(root)||event.results||Object.values(room.adminSelections||{}).some(v=>Object.keys(v||{}).length))return fail("membership_locked");
 if(!safeUid(groupId)||!Object.hasOwn(reg?.groups||{},groupId))return fail("invalid_group");
 const group=reg.groups[groupId],groups=omitKey(reg.groups,groupId);
 let membership={...reg.membership},players={...event.players},chatModeration={...event.chatModeration},votes={...event.votes};
 let retained=0,unregistered=0;
 for(const uid of Object.keys(group.members||{})){
  const ids=membershipIds(reg,uid).filter(id=>id!==groupId);
  membership=membershipIndex({membership},uid,ids);
  if(ids.length){retained++;if(players[uid]?.groupId===groupId)players[uid]={...players[uid],groupId:ids[0]};}
  else{unregistered++;delete players[uid];delete chatModeration[uid];delete votes[uid];}
 }
 const next=replace(root,{...event,registration:{...reg,groups,membership},players,votes,chatModeration,chats:omitKey(event.chats,groupId),chatReports:omitKey(event.chatReports,groupId)});
 return {state:next,result:{accepted:true,groupId,retained,unregistered}};
}
export function verifyGroupDeleted(root,groupId){
 const event=eventOf(root),reg=event.registration||{};
 return !Object.hasOwn(reg.groups||{},groupId)&&!Object.hasOwn(event.chats||{},groupId)&&!Object.hasOwn(event.chatReports||{},groupId)&&!Object.values(reg.membership||{}).some(raw=>(typeof raw==="string"?[raw]:Object.values(raw||{})).includes(groupId))&&!Object.values(event.players||{}).some(p=>p.groupId===groupId);
}
