import test from "node:test";
import assert from "node:assert/strict";
import {createGroup,joinGroup,membershipIds,membershipView} from "./registration.mjs";
import {acceptInvitation,manageGroup,removePlayer,ownerView} from "./management.mjs";
import {chatAction,chatView} from "./chat.mjs";
import {enterGame,castVote,publishFinal,gameView,adminGameView} from "./game.mjs";
import {authenticateGroupMember} from "./recovery.mjs";
const digest="a".repeat(64);
function fixture(){
 let s=createGroup(null,{uid:"marc",id:"a",name:"Famille",pseudo:"Marc",secret:"a",now:1}).state;
 s=createGroup(s,{uid:"jean",id:"b",name:"Travail",pseudo:"Jean",secret:"b",now:2}).state;
 s=createGroup(s,{uid:"johan",id:"c",name:"Amis",pseudo:"Johan",secret:"c",now:3}).state;
 s=createGroup(s,{uid:"x",id:"d",name:"Autres",pseudo:"X",secret:"d",now:4}).state;
 return {rooms:{miss2027:{gameId:"game",connectionsOpen:true,tour:1,votesOpen:false}},events:{miss2027:{registration:s}}};
}
const reg=r=>r.events.miss2027.registration;
const join=(r,id)=>joinGroup(reg(r),{uid:"marc",id,pseudo:"Another",verifiedSecret:id,additional:true,now:5});
test("three groups, same pseudo, idempotence, no fourth",()=>{
 let r=fixture();r.events.miss2027.registration=join(r,"b").state;
 r=manageGroup(r,{uid:"johan",action:"invite",digest}).state;
 r=acceptInvitation(r,{uid:"marc",digest,pseudo:"Wrong",additional:true,now:6}).state;
 assert.deepEqual(membershipIds(reg(r),"marc"),["a","b","c"]);
 assert.equal(membershipView(reg(r),"marc","c").pseudo,"Marc");
 assert.equal(join(r,"c").result.alreadyRegistered,true);
 assert.equal(join(r,"d").code,"group_limit");
 assert.equal(createGroup(reg(r),{uid:"marc",id:"e",name:"More",pseudo:"Marc",secret:"e",additional:true}).code,"group_limit");
 assert.equal(ownerView(r,"marc","b").code,"owner_required");
});
test("additional creation and removal preserve other groups and recovery uses any group password",async()=>{
 let r=fixture();r.events.miss2027.registration=join(r,"b").state;
 r.events.miss2027.registration=createGroup(reg(r),{uid:"marc",id:"e",name:"More",pseudo:"Wrong",secret:"e",additional:true,now:6}).state;
 assert.equal(ownerView(r,"marc","e").result.group.pseudo,"Marc");
 const recover=await authenticateGroupMember({read:async()=>r,matches:async(p,s)=>p===s,requesterUid:"new",pseudo:"Marc",password:"b",adminUid:"admin"});
 assert.equal(recover.result.uid,"marc");
 r=manageGroup(r,{uid:"jean",groupId:"b",action:"remove",targetUid:"marc"}).state;
 assert.deepEqual(membershipIds(reg(r),"marc"),["a","e"]);
 r=removePlayer(r,{targetUid:"marc",groupId:"e",gameId:"game",confirmed:true,now:9}).state;
 assert.deepEqual(membershipIds(reg(r),"marc"),[]);
 assert.equal(reg(r).groups.a.members.marc,undefined);
});
test("separate chat and a single vote / national score across groups",()=>{
 let r=fixture();r.events.miss2027.registration=join(r,"b").state;
 r=chatAction(r,{uid:"marc",groupId:"b",text:"Bonjour",id:"m",now:1}).state;
 assert.equal(chatView(r,{uid:"marc",groupId:"a"}).result.messages.length,0);
 assert.equal(chatView(r,{uid:"jean",groupId:"b"}).result.messages.length,1);
 assert.equal(chatView(r,{uid:"marc",groupId:"d"}).code,"not_registered");
 r=enterGame(r,{uid:"marc",now:2}).state;
 const tour1=Array.from({length:12},(_,i)=>i+1),tour2=[1,2,3,4,5];
 r.rooms.miss2027.votesOpen=true;
 r=castVote(r,{uid:"marc",gameId:"game",tour:1,selection:tour1,favorite:1,now:3}).state;
 assert.equal(castVote(r,{uid:"marc",gameId:"game",tour:1,selection:tour1,favorite:1}).result.alreadyRecorded,true);
 Object.assign(r.rooms.miss2027,{tour:3,votesOpen:false,adminSelections:{tour1,tour2,tour3:tour2}});
 r=publishFinal(r,{gameId:"game"}).state;
 const v=gameView(r,"marc").result;
 assert.equal(v.final.nationalTotal,1);assert.equal(v.finals.length,2);
 assert.equal(v.finals[0].local[0].points,v.finals[1].local[0].points);
 assert.deepEqual(adminGameView(r).players.marc.groupIds,["a","b"]);
});
