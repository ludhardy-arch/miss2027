// Test-only private and public registration state. Server-owned; never exposed as a whole.
export const normalizeName = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
export function distance(a,b) {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  return row[b.length];
}
export function searchGroups(state, query) {
  const q=normalizeName(query);
  if(!q)return [];
  return Object.entries(state?.groups||{}).filter(([,g])=>{
    if(g.type==="public")return false;
    const n=normalizeName(g.name);
    return n.includes(q)||q.split(" ").every(w=>n.split(" ").some(c=>c.includes(w)||(w.length>=4&&distance(w,c)<=(w.length>=7?2:1))));
  }).map(([id,g])=>({id,name:g.name})).sort((a,b)=>a.name.localeCompare(b.name,"fr")).slice(0,30);
}
const fail=code=>({code});
export const PRIVATE_CAPACITY=30;
// One display name throughout the contest; compare case, accents and repeated spaces.
export const normalizePseudo=value=>typeof value==="string"?normalizeName(value.normalize("NFKC")):"";
export function pseudoAvailable(state,pseudo,uid){
  const key=normalizePseudo(pseudo);
  if(!key||typeof pseudo!=="string"||pseudo.length>24)return false;
  for(const group of Object.values(state?.groups||{})){
    for(const [memberUid,member] of Object.entries(group.members||{})){
      if(memberUid!==uid&&normalizePseudo(member?.pseudo)===key)return false;
    }
  }
  return true;
}
function checkPseudo(state,pseudo,uid){
  if(!normalizePseudo(pseudo)||typeof pseudo!=="string"||pseudo.length>24)return fail("invalid_fields");
  if(!pseudoAvailable(state,pseudo,uid))return fail("pseudo_taken");
  return null;
}
export function groupNameAvailable(state,name){
  const key=normalizePseudo(name);
  if(!key||typeof name!=="string"||name.length>80)return false;
  // Reserve system-generated public room names, including future rooms.
  if(/^salle publique [0-9]+$/.test(key))return false;
  return !Object.values(state?.groups||{}).some(group=>normalizePseudo(group?.name)===key);
}
export function createGroup(state,{uid,id,name,pseudo,secret,now}) {
  const s=state||{};
  if(s.membership?.[uid])return fail("already_member");
  if(s.groups?.[id])return fail("conflict");
  if(!normalizePseudo(name)||typeof name!=="string"||name.length>80)return fail("invalid_fields");
  if(!groupNameAvailable(s,name))return fail("group_name_taken");
  const invalid=checkPseudo(s,pseudo,uid);if(invalid)return invalid;
  const group={type:"private",name,ownerUid:uid,capacity:PRIVATE_CAPACITY,registrationsOpen:true,secret,createdAt:now,members:{[uid]:{pseudo,joinedAt:now}}};
  return {state:{...s,groups:{...s.groups,[id]:group},membership:{...s.membership,[uid]:id}},result:{id,name}};
}
export function joinGroup(state,{uid,id,pseudo,verifiedSecret,now}) {
  const s=state||{};
  const g=s.groups?.[id];
  const existing=membershipView(s,uid);
  if(existing?.id===id)return {state:s,result:{id,name:g.name,group:existing,alreadyRegistered:true}};
  if(s.membership?.[uid])return fail("already_member");
  if(!g||g.type==="public")return fail("unavailable");
  if(g.secret!==verifiedSecret)return fail("invalid_password");
  if(Object.keys(g.members||{}).length>=PRIVATE_CAPACITY)return fail("group_full");
  const invalid=checkPseudo(s,pseudo,uid);if(invalid)return invalid;
  const group={...g,members:{...g.members,[uid]:{pseudo,joinedAt:now}}};
  return {state:{...s,groups:{...s.groups,[id]:group},membership:{...s.membership,[uid]:id}},result:{id,name:g.name}};
}

export const PUBLIC_CAPACITY=30;
export function membershipView(state,uid){
  const id=state?.membership?.[uid];
  const group=id&&state.groups?.[id];
  const member=group?.members?.[uid];
  if(!group||!member)return null;
  return {id,name:group.name,pseudo:member.pseudo,type:group.type==="public"?"public":"private",isOwner:group.ownerUid===uid,memberCount:Object.keys(group.members).length};
}
export function registerPublic(root,{uid,pseudo,now}){
  // Root transaction checks the real national opening flag atomically with
  // the shared membership index and the 30-player capacity.
  if(root?.rooms?.miss2027?.connectionsOpen!==true)return fail("public_closed");
  const event=root.events?.miss2027||{};
  const s=event.registration||{};
  const existing=membershipView(s,uid);
  if(existing)return {state:root,result:{group:existing,alreadyRegistered:true}};
  if(s.membership?.[uid])return fail("conflict");
  const invalid=checkPseudo(s,pseudo,uid);if(invalid)return invalid;
  const groups=s.groups||{};
  const publicRooms=Object.entries(groups).filter(([,g])=>g.type==="public").sort((a,b)=>a[1].number-b[1].number);
  const available=publicRooms.find(([,g])=>g.registrationsOpen!==false&&Object.keys(g.members||{}).length<PUBLIC_CAPACITY);
  let id,group;
  if(available){[id,group]=available;}
  else{
    const number=Math.max(0,...publicRooms.map(([,g])=>Number(g.number)||0))+1;
    id="public-"+number;
    if(groups[id])return fail("conflict");
    group={type:"public",number,name:"Salle publique "+number,capacity:PUBLIC_CAPACITY,registrationsOpen:true,createdAt:now,members:{}};
  }
  const next={...s,groups:{...groups,[id]:{...group,members:{...group.members,[uid]:{pseudo,joinedAt:now}}}},membership:{...s.membership,[uid]:id}};
  return {state:{...root,events:{...root.events,miss2027:{...event,registration:next}}},result:{group:membershipView(next,uid),alreadyRegistered:false}};
}
