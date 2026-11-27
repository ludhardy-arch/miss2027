import {buildFinalResults} from "../finalResults.js";
import {membershipView} from "./registration.mjs";
import {CANDIDATES} from "../../src/data/candidates.js";
const ids=CANDIDATES.map(c=>c.id);
const fail=code=>({code});
const list=v=>Array.isArray(v)?v:Object.values(v||{});
function context(root,uid){
 const room=root?.rooms?.miss2027,event=root?.events?.miss2027||{};
 const group=membershipView(event.registration,uid);
 return {room,event,group,entered:!!group&&event.players?.[uid]?.groupId===group.id};
}
function stateWith(root,event){return {...root,events:{...root.events,miss2027:event}};}
export function enterGame(root,{uid,now}){
 const {room,event,group,entered}=context(root,uid);
 if(!group)return fail("not_registered");
 if(!room?.gameId)return fail("game_unavailable");
 if(!entered&&room.connectionsOpen!==true)return fail("public_closed");
 if(!entered&&room.finaleStarted===true)return fail("game_finished");
 const next=entered?event:{...event,players:{...event.players,[uid]:{groupId:group.id,enteredAt:now}}};
 return {state:stateWith(root,next),result:{group,gameId:String(room.gameId)}};
}
export function gameView(root,uid){
 const {room,event,group,entered}=context(root,uid);
 if(!group||!entered)return fail("not_registered");
 if(!room?.gameId)return fail("game_unavailable");
 const tour=Number(room.tour||1), own=event.votes?.[uid]||{};
 const key="tour"+tour;
 const published=room.finaleStarted===true&&event.results?.gameId===String(room.gameId)?event.results:null;
 const final=published?{local:list(published.local?.[group.id]),personal:published.perPlayer?.[uid]||null,nationalTop:list(published.nationalTop),nationalTotal:published.nationalTotal,version:published.gameId}:null;
 const ownVote={};
 for(const k of ["tour1","tour2","tour3","favorite"])if(own[k]!==undefined)ownVote[k]=own[k];
 const official={tour1:tour>=2?list(room.adminSelections?.tour1):[],tour2:tour>=3?list(room.adminSelections?.tour2):[],tour3:[]};
 // Only the player's own ballots leave the server. Group trends are aggregate
 // and are unavailable until that player has voted this round.
 const counts={},members=event.registration.groups[group.id].members||{};
 let validated=0;
 if(list(own[key]).length){
   for(const memberUid of Object.keys(members)){
     const vote=list(event.votes?.[memberUid]?.[key]);
     if(!vote.length)continue;
     validated++;
     vote.forEach((id,index)=>{if(ids.includes(id))counts[id]=(counts[id]||0)+(tour===3?5-index:1);});
   }
 }
 return {result:{group,gameId:String(room.gameId),tour,votesOpen:room.votesOpen===true&&room.finaleStarted!==true,finaleStarted:room.finaleStarted===true,adminSelections:official,ownVote,final,trend:{counts,validated,total:Object.keys(members).length}}};
}
export function castVote(root,{uid,gameId,tour,selection,favorite,now}){
 const {room,event,group,entered}=context(root,uid);
 if(!group||!entered)return fail("not_registered");
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(![1,2,3].includes(tour)||Number(room.tour||1)!==tour)return fail("round_changed");
 if(room.votesOpen!==true||room.finaleStarted===true)return fail("votes_closed");
 const allowed=tour===1?ids:list(room.adminSelections?.["tour"+(tour-1)]);
 const needed=tour===1?12:5;
 if(!Array.isArray(selection)||selection.length!==needed||new Set(selection).size!==needed||selection.some(id=>!Number.isInteger(id)||!ids.includes(id)||!allowed.includes(id)))return fail("invalid_vote");
 if(tour===1&&(!Number.isInteger(favorite)||!selection.includes(favorite)))return fail("invalid_favorite");
 const key="tour"+tour,old=event.votes?.[uid]||{};
 if(old[key]){
   const same=JSON.stringify(list(old[key]))===JSON.stringify(selection)&&(tour!==1||old.favorite===favorite);
   return same?{state:root,result:{accepted:true,alreadyRecorded:true}}:fail("already_voted");
 }
 const vote={...old,[key]:selection,...(tour===1?{favorite}:{}),updatedAt:now};
 const next={...event,votes:{...event.votes,[uid]:vote}};
 return {state:stateWith(root,next),result:{accepted:true}};
}

export function adminGameView(root){
 const event=root?.events?.miss2027||{},room=root?.rooms?.miss2027||{};
 const players={};
 for(const uid of Object.keys(event.registration?.membership||{})){
   const group=membershipView(event.registration,uid);
   if(!group)continue;
   const own=event.votes?.[uid]||{};
   const record={uid,chatBlocked:event.chatModeration?.[uid]===true,pseudo:group.pseudo,groupName:group.name,groupId:group.id,entered:event.players?.[uid]?.groupId===group.id};
   for(const key of ["tour1","tour2","tour3","favorite"])if(own[key]!==undefined)record[key]=own[key];
   players[uid]=record;
 }
 const groups=Object.entries(event.registration?.groups||{}).map(([id,g])=>({id,name:g.name,type:g.type==="public"?"public":"private",memberCount:Object.keys(g.members||{}).length,ownerPseudo:g.members?.[g.ownerUid]?.pseudo||null})).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
 return {players,groups,tour:Number(room.tour||1),gameId:String(room.gameId||""),votesOpen:room.votesOpen===true,groupCount:groups.length};
}
export function advanceRound(root,{gameId,tour,selection}){
 const room=root?.rooms?.miss2027;
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(![1,2,3].includes(tour)||Number(room.tour||1)!==tour)return fail("round_changed");
 if(room.votesOpen===true||room.finaleStarted===true)return fail("close_votes_first");
 const allowed=tour===1?ids:list(room.adminSelections?.["tour"+(tour-1)]),needed=tour===1?12:5;
 if(!Array.isArray(selection)||selection.length!==needed||new Set(selection).size!==needed||selection.some(id=>!Number.isInteger(id)||!allowed.includes(id)||!ids.includes(id)))return fail("invalid_vote");
 return {state:{...root,rooms:{...root.rooms,miss2027:{...room,adminSelections:{...room.adminSelections,["tour"+tour]:selection},tour:Math.min(tour+1,3)}}},result:{tour:Math.min(tour+1,3),accepted:true}};
}

export function publishFinal(root,{gameId}){
 const room=root?.rooms?.miss2027,event=root?.events?.miss2027||{};
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(room.finaleStarted===true)return event.results?.gameId===gameId?{state:root,result:{accepted:true,alreadyPublished:true}}:fail("already_started");
 if(Number(room.tour)!==3||room.votesOpen!==false)return fail("close_votes_first");
 const players={},groups={},membershipsByGroup={},eligibleUids=[];
 for(const [id,g] of Object.entries(event.registration?.groups||{})){
   groups[id]={type:g.type==="public"?"public":"private"};
   membershipsByGroup[id]={};
   for(const uid of Object.keys(g.members||{})){
     const group=membershipView(event.registration,uid);
     if(group?.id!==id||event.players?.[uid]?.groupId!==id)continue;
     players[uid]={pseudo:group.pseudo};membershipsByGroup[id][uid]=true;
     const vote=event.votes?.[uid]||{};
     if(["tour1","tour2","tour3"].some(k=>list(vote[k]).length>0))eligibleUids.push(uid);
   }
 }
 let calculated;
 try{calculated=buildFinalResults({players,groups,membershipsByGroup,eligibleUids,votesByUid:event.votes||{},adminSelections:room.adminSelections||{}});}
 catch{return fail("invalid_final_results");}
 // No national raw ballots or national full ranking are returned to players.
 const results={gameId,local:calculated.local,perPlayer:calculated.perPlayer,nationalTop:calculated.national.filter(p=>p.rank<=3).map(({pseudo,points,rank})=>({pseudo,points,rank})),nationalTotal:calculated.national.length};
 const next=stateWith(root,{...event,results});
 return {state:{...next,rooms:{...root.rooms,miss2027:{...room,votesOpen:false,connectionsOpen:false,finaleStarted:true}}},result:{accepted:true,total:results.nationalTotal}};
}

export function setVoteOpening(root,{gameId,open}){
 const room=root?.rooms?.miss2027;
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(typeof open!=="boolean")return fail("invalid_action");
 if(room.finaleStarted===true)return fail("game_finished");
 return {state:{...root,rooms:{...root.rooms,miss2027:{...room,votesOpen:open,registrationLocked:room.registrationLocked===true||open}}},result:{votesOpen:open}};
}

// Opening/closing connections must never replace registrations, players, ballots or chats.
export function setConnectionOpening(root,{gameId,open}){
 const room=root?.rooms?.miss2027;
 if(!room?.gameId||String(room.gameId)!==gameId)return fail("game_changed");
 if(typeof open!=="boolean")return fail("invalid_action");
 if(open&&room.finaleStarted===true)return fail("game_finished");
 return {state:{...root,rooms:{...root.rooms,miss2027:{...room,connectionsOpen:open,...(open?{demoEnabled:false}:{})}}},result:{connectionsOpen:open}};
}
// A control switch is not a reset. The entire event must survive unchanged.
export function protectedControlChange(root,operation){
 const next=operation(root);
 if(next.code)return next;
 if(!next.state||next.state.events!==root?.events||next.state.rooms?.miss2027?.gameId!==root?.rooms?.miss2027?.gameId)return fail("control_data_changed");
 return next;
}
