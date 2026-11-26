import {membershipView,joinGroup} from "./registration.mjs";
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
 return {result:{group:{...view,entered:event.players?.[uid]?.groupId===view.id,registrationsOpen:group.registrationsOpen===true,locked:locked(root),invitationActive:!!group.inviteDigest,members:Object.entries(group.members).map(([id,m])=>({id,pseudo:m.pseudo,isOwner:id===uid}))}}};
}
export function manageGroup(root,{uid,action,value,targetUid,digest}){
 const initial=ownerView(root,uid);
 if(initial.code)return initial;
 const event=eventOf(root),reg=event.registration,id=initial.result.group.id,g=reg.groups[id];
 if(locked(root)&&action!=="revoke")return fail("membership_locked");
 let group={...g},membership=reg.membership,players=event.players;
 if(action==="rename"){
   if(typeof value!=="string"||!value.trim()||value.length>80)return fail("invalid_fields");
   group.name=value.trim();
 }else if(action==="open"){
   if(typeof value!=="boolean")return fail("invalid_fields");
   group.registrationsOpen=value;
 }else if(action==="invite"){
   if(!/^[a-f0-9]{64}$/.test(digest||""))return fail("invalid_fields");
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
 const entry=Object.entries(eventOf(root).registration?.groups||{}).find(([,g])=>g.type==="private"&&g.registrationsOpen===true&&g.inviteDigest===digest);
 if(!entry)return fail("unavailable");
 return {result:{group:{id:entry[0],name:entry[1].name}}};
}
export function acceptInvitation(root,{uid,digest,pseudo,now}){
 const event=eventOf(root),reg=event.registration;
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
