// Pure, test-only reset operations. Never delete an entire database or event.
const without=(value,keys)=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>!keys.includes(key)));
const voteFields=["tour1","tour2","tour3","favorite","points","score","rank","ranking","results","votes"];
const gameFields=["votes","results","nationalTop","leaderboard","scores","rankings"];
const registrationFields=["registration","groups","groupDirectory","groupMembers","playerGroup","players","invitations","invites","groupSecrets","chats","chat","chatModeration",...gameFields];
const resetControl=(control,id)=>({...without(control,["resultsVersion","finalePhase","finaleStage","resultsPublished"]),gameId:id,tour:1,votesOpen:false,finaleStarted:false});
const hasVotes=players=>Object.values(players||{}).some(p=>p&&["tour1","tour2","tour3","favorite","votes"].some(k=>p[k]!=null));
export function resetContest(root,kind,id){
  if(!root||typeof root!=="object")return {code:"room_not_initialized"};
  const room=root.rooms?.miss2027;
  if(!room||typeof room!=="object")return {code:"room_not_initialized"};
  const event=root.events?.miss2027||{};
  const control=event.control||{};
  let newRoom,newEvent;
  if(kind==="game"){
    newRoom={...without(room,gameFields),players:Object.fromEntries(Object.entries(room.players||{}).map(([key,p])=>[key,without(p,voteFields)])),adminSelections:{},tour:1,votesOpen:false,finaleStarted:false,gameId:id};
    newEvent={...without(event,[...gameFields,"officialSelections"]),control:resetControl(control,id)};
  }else if(kind==="registrations"){
    // Do not erase participants from a live or completed round. Reset the game first.
    if(room.votesOpen===true||room.finaleStarted===true||Number(room.tour||1)!==1||control.votesOpen===true||control.finaleStarted===true||Number(control.tour||1)!==1||hasVotes(room.players)||Object.keys(event.votes||{}).length||Object.keys(room.adminSelections||{}).some(k=>Object.keys(room.adminSelections[k]||{}).length)||Object.keys(event.officialSelections||{}).some(k=>Object.keys(event.officialSelections[k]||{}).length)||event.results||room.results||control.resultsVersion)return {code:"reset_game_first"};
    newRoom={...without(room,["players","chat","chats","invitations",...gameFields]),connectionsOpen:false,gameId:id};
    newEvent={...without(event,registrationFields),registration:{epoch:id},control:{...without(control,["resultsVersion"]),connectionsOpen:false,gameId:id}};
  }else return {code:"invalid_reset"};
  return {state:{...root,rooms:{...root.rooms,miss2027:newRoom},events:{...root.events,miss2027:newEvent}},result:{kind,gameId:id}};
}
