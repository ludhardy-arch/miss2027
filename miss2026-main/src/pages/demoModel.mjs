import {buildFinalResults} from "../../multigroup/finalResults.js";
export const QUALIFIED=[1,3,5,7,9,11,13,15,18,21,25,29];
export const FINALISTS=[3,5,9,15,25];
export const OFFICIAL=[5,25,9,3,15];
export const DEMO_OFFICIAL={tour1:QUALIFIED,tour2:FINALISTS,tour3:OFFICIAL};
export const DEMO_USER={uid:"demo-self",pseudo:"Vous",groupId:"demo-group",groupName:"Groupe de démonstration"};
const pick=(a,n)=>a.slice(0,n);
const bots=[
 ["Camille",5,pick(QUALIFIED,9).concat([2,4,6]),[5,25,3,9,15]],
 ["Alex",7,pick(QUALIFIED.slice(2),7).concat([2,4,6,8,10]),[25,5,9,15,3]],
 ["Sophie",5,pick(QUALIFIED.slice(1),8).concat([2,4,6,8]),[5,9,25,3,15]],
 ["Maxime",7,pick(QUALIFIED,6).concat([2,4,6,8,10,12]),[9,5,3,25,15]],
 ["Julie",15,pick(QUALIFIED.slice(3),7).concat([2,4,6,8,10]),[5,25,9,3,15]],
 ["Thomas",5,pick(QUALIFIED,8).concat([2,4,6,8]),[3,9,5,15,25]]
].map(([pseudo,favorite,tour1,tour3],i)=>({uid:"demo-bot-"+i,pseudo,favorite,tour1,tour2:FINALISTS.slice(),tour3}));
export function demoRecords(tour,ballots,waiting){
 const result={[DEMO_USER.pseudo]:ballots};
 for(const bot of bots){
  const votes={};
  for(let t=1;t<=3;t++)if(t<tour||(waiting&&t===tour)){votes["tour"+t]=bot["tour"+t];if(t===1)votes.favorite=bot.favorite;}
  result[bot.pseudo]=votes;
 }
 return result;
}
export function demoResult(ballots){
 const people=[{...ballots,...DEMO_USER},...bots],players={},votesByUid={},membership={};
 for(const p of people){players[p.uid]={pseudo:p.pseudo};votesByUid[p.uid]={tour1:p.tour1,tour2:p.tour2,tour3:p.tour3,favorite:p.favorite};membership[p.uid]=true;}
 const result=buildFinalResults({players,votesByUid,groups:{"demo-group":{type:"private"}},membershipsByGroup:{"demo-group":membership},eligibleUids:Object.keys(players),adminSelections:DEMO_OFFICIAL});
 return {local:result.local["demo-group"],personal:result.perPlayer[DEMO_USER.uid],nationalTop:result.national.filter(p=>p.rank<=3),nationalTotal:result.national.length};
}
export function memoryDraftStore(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
export function demoVote(ballots,tour,selection,favorite){
 const allowed=tour===1?Array.from({length:31},(_,i)=>i+1):tour===2?QUALIFIED:FINALISTS;
 const key="tour"+tour,needed=tour===1?12:5;
 if(![1,2,3].includes(tour)||ballots[key]||tour>1&&!ballots["tour"+(tour-1)]||!Array.isArray(selection)||selection.length!==needed||new Set(selection).size!==needed||selection.some(id=>!allowed.includes(id))||tour===1&&!selection.includes(favorite))throw Error("Vote de démonstration invalide.");
 return {...ballots,[key]:selection.slice(),...(tour===1?{favorite}:{})};
}
