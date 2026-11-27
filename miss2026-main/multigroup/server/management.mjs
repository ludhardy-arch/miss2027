import {membershipView,joinGroup,normalizePseudo,isExcluded} from "./registration.mjs";
const fail=code=>({code});
const eventOf=root=>root?.events?.miss2027||{};
const replace=(root,event)=>({...root,events:{...root.events,miss2027:event}});
export function locked(root){
 const room=root?.rooms?.miss2027,event=eventOf(root);
 return room?.registrationLocked===true||room?.votesOpen===true||room?.finaleStarted===true||Number(room?.tour||1)!==1||Object.keys(event.votes||{}).length>0;
}
export function ownerView(root,uid){
 const event=eventOf(root),reg=event.registration,view=membershipView(reg,uid);
 if(!view?.isOwner)return fail("owner_required");
 const group=reg.groups[view.id];
 return {result:{group:{...view,entered:event.players?.[uid]?.groupId===view.id,registrationsOpen:!locked(root)&&Object.keys(group.members||{}).length<30,locked:locked(root),invitationActive:!!group.inviteDigest,members:Object.entries(group.members).map(([id,m])=>({id,pseudo:m.pseudo,isOwner:id===uid}))}}};
}
export function manageGroup(root,{uid,action,value,targetUid,digest,verifiedSecret,reuse=false}){
 const initial=ownerView(root,uid);
 if(initial.code)return initial;
 const event=eventOf(root),reg=event.registration,id=initial.result.group.id,g=reg.groups[id];
 if(locked(root)&&action!=="revoke")return fail("membership_locked");
 let group={...g},membership=reg.membership,players=event.players;
 if(action==="invite"||action==="prepare_invite"){
   if(!/^[a-f0-9]{64}$/.test(digest||""))return fail("invalid_fields");
   if(action==="prepare_invite"){
     if(typeof verifiedSecret!=="string"||g.secret!==verifiedSecret)return fail("invalid_password");
     if(!initial.result.group.registrationsOpen)return fail("group_full");
     if(reuse)return g.inviteDigest===digest?{state:root,result:initial.result}:fail("invitation_changed");
   }
   group.inviteDigest=digest;
 }else if(action==="revoke"){delete group.inviteDigest;}
 else if(action==="remove"){
   if(typeof targetUid!=="string"||targetUid===uid||!Object.hasOwn(g.members,targetUid)||reg.membership?.[targetUid]!==id)return fail("invalid_member");
   const members={...g.members};delete members[targetUid];group.members=members;
   membership={...membership};delete membership[targetUid];
   players={...players};delete players[targetUid];
 }else return fail("invalid_action");
 const next=replace(root,{...event,players,registration:{...reg,membership,groups:{...reg.groups,[id]:group}}});
 return {state:next,result:ownerView(next,uid).result};
}
export function invitationView(root,digest){
 if(!/^[a-f0-9]{64}$/.test(digest||"")||locked(root))return fail("unavailable");
 const entry=Object.entries(eventOf(root).registration?.groups||{}).find(([,g])=>g.type==="private"&&g.inviteDigest===digest);
 if(!entry)return fail("unavailable");
 return {result:{group:{id:entry[0],name:entry[1].name}}};
}
export function acceptInvitation(root,{uid,digest,pseudo,now}){
 const event=eventOf(root),reg=event.registration;
 if(isExcluded(reg,uid))return fail("player_removed");
 const existing=membershipView(reg,uid);
 if(existing)return {state:root,result:{group:existing,alreadyRegistered:true}};
 const view=invitationView(root,digest);
 if(view.code)return view;
 const id=view.result.group.id;
 const joined=joinGroup(reg,{uid,id,pseudo,verifiedSecret:reg.groups[id].secret,now});
 if(joined.code)return joined;
 const next=replace(root,{...event,registration:joined.state});
 return {state:next,result:{group:membershipView(joined.state,uid)}};
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
 const view=membershipView(reg,targetUid);
 if(!view||view.id!==groupId)return fail("invalid_member");
 const original=reg.groups[groupId],members=omitKey(original.members,targetUid);
 const group={...original,members};
 // Keep the group and chat. If its creator is removed, the oldest remaining
 // member becomes organizer. An empty private group has no owner until joined.
 if(original.ownerUid===targetUid){
   const next=Object.entries(members).sort(([a,x],[b,y])=>(Number(x.joinedAt)||0)-(Number(y.joinedAt)||0)||a.localeCompare(b))[0];
   if(next)group.ownerUid=next[0];else delete group.ownerUid;
   delete group.inviteDigest;
 }
 const registration={...reg,groups:{...reg.groups,[groupId]:group},membership:omitKey(reg.membership,targetUid),excluded:{...reg.excluded,[targetUid]:{pseudo:normalizePseudo(view.pseudo),at:now}}};
 const next=replace(root,{...event,registration,players:omitKey(event.players,targetUid),votes:omitKey(event.votes,targetUid),chatModeration:omitKey(event.chatModeration,targetUid)});
 return {state:next,result:{accepted:true,removedUid:targetUid,groupId,remaining:Object.keys(members).length}};
}
