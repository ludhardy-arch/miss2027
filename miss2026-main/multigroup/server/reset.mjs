// Pure, test-only reset operations. Never delete an entire database or event.
const without=(value,keys)=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>!keys.includes(key)));
const voteFields=["tour1","tour2","tour3","favorite","points","score","rank","ranking","results","votes"];
const gameFields=["votes","results","nationalTop","leaderboard","scores","rankings"];
const registrationFields=["registration","groups","groupDirectory","groupMembers","playerGroup","players","invitations","invites","groupSecrets","chats","chat","chatModeration",...gameFields];
const resetControl=(control,id)=>({...without(control,["resultsVersion","finalePhase","finaleStage","resultsPublished"]),gameId:id,tour:1,votesOpen:false,finaleStarted:false});
const hasVotes=players=>Object.values(players||{}).some(p=>p&&["tour1","tour2","tour3","favorite","votes"].some(k=>p[k]!=null&&(typeof p[k]!=="object"||Object.keys(p[k]).length>0)));
const count=value=>Object.keys(value||{}).length;
export function registrationCounts(root){const e=root?.events?.miss2027||{},r=e.registration||{};return {groups:count(r.groups),players:count(r.membership),chats:count(e.chats),entered:count(e.players)};}
export function verifyReset(root,kind,id){
 const room=root?.rooms?.miss2027,e=root?.events?.miss2027||{};
 if(room?.gameId!==id)return false;
 if(kind==="registrations")return e.registration?.epoch===id&&Object.values(registrationCounts(root)).every(n=>n===0)&&!count(room.players)&&!count(room.chat)&&!count(e.invitations)&&!count(e.chatModeration);
 return room.tour===1&&room.votesOpen===false&&room.finaleStarted===false&&!count(e.votes)&&!Object.values(room.adminSelections||{}).some(v=>count(v))&&!hasVotes(room.players)&&!e.results;
}
export function resetContest(root,kind,id){
  if(!root||typeof root!=="object")return {code:"room_not_initialized"};
  const room=root.rooms?.miss2027;
  if(!room||typeof room!=="object")return {code:"room_not_initialized"};
  const event=root.events?.miss2027||{};
  const control=event.control||{};
  let newRoom,newEvent;
  if(kind==="game"){
    newRoom={...without(room,gameFields),players:Object.fromEntries(Object.entries(room.players||{}).map(([key,p])=>[key,without(p,voteFields)])),adminSelections:{},tour:1,votesOpen:false,registrationLocked:false,finaleStarted:false,gameId:id};
    newEvent={...without(event,[...gameFields,"officialSelections"]),control:resetControl(control,id)};
  }else if(kind==="registrations"){
    // Do not erase participants from a live or completed round. Reset the game first.
    const reasons=[];
    if(room.votesOpen===true||control.votesOpen===true)reasons.push("votes_open");
    if(room.finaleStarted===true||control.finaleStarted===true)reasons.push("finale");
    if(Number(room.tour||1)!==1||Number(control.tour||1)!==1)reasons.push("round");
    if(hasVotes(room.players)||count(event.votes))reasons.push("votes_exist");
    if(Object.values(room.adminSelections||{}).some(v=>count(v))||Object.values(event.officialSelections||{}).some(v=>count(v)))reasons.push("official_selections");
    if(event.results||room.results||control.resultsVersion)reasons.push("results_exist");
    if(reasons.length)return {code:"reset_game_first",reasons};
    newRoom={...without(room,["players","chat","chats","invitations",...gameFields]),connectionsOpen:false,registrationLocked:false,gameId:id};
    newEvent={...without(event,registrationFields),registration:{epoch:id},control:{...without(control,["resultsVersion"]),connectionsOpen:false,gameId:id}};
  }else return {code:"invalid_reset"};
  return {state:{...root,rooms:{...root.rooms,miss2027:newRoom},events:{...root.events,miss2027:newEvent}},result:{kind,gameId:id,before:registrationCounts(root)}};
}
