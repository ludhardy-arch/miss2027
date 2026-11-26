// Test-only private registration state. Server-owned; never exposed as a whole.
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
    if(!g.registrationsOpen)return false;
    const n=normalizeName(g.name);
    return n.includes(q)||q.split(" ").every(w=>n.split(" ").some(c=>c.includes(w)||(w.length>=4&&distance(w,c)<=(w.length>=7?2:1))));
  }).map(([id,g])=>({id,name:g.name})).sort((a,b)=>a.name.localeCompare(b.name,"fr")).slice(0,30);
}
const fail=code=>({code});
export function createGroup(state,{uid,id,name,pseudo,secret,now}) {
  const s=state||{};
  if(s.membership?.[uid])return fail("already_member");
  if(s.groups?.[id])return fail("conflict");
  const group={name,ownerUid:uid,registrationsOpen:true,secret,createdAt:now,members:{[uid]:{pseudo,joinedAt:now}}};
  return {state:{...s,groups:{...s.groups,[id]:group},membership:{...s.membership,[uid]:id}},result:{id,name}};
}
export function joinGroup(state,{uid,id,pseudo,verifiedSecret,now}) {
  const s=state||{};
  const g=s.groups?.[id];
  if(s.membership?.[uid])return fail("already_member");
  if(!g||!g.registrationsOpen)return fail("unavailable");
  if(g.secret!==verifiedSecret)return fail("invalid_password");
  const group={...g,members:{...g.members,[uid]:{pseudo,joinedAt:now}}};
  return {state:{...s,groups:{...s.groups,[id]:group},membership:{...s.membership,[uid]:id}},result:{id,name:g.name}};
}
