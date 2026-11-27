import test from "node:test";
import assert from "node:assert/strict";
import {authenticateGroupMember} from "./recovery.mjs";
import {createGroup,joinGroup,membershipView,registerPublic} from "./registration.mjs";
import {resetContest} from "./reset.mjs";
import {gameView} from "./game.mjs";
const fixture=()=>{
 let reg=createGroup(null,{uid:"u1",id:"g",name:"Famille",pseudo:"Rod",secret:"group-hash",now:1}).state;
 reg=joinGroup(reg,{uid:"u2",id:"g",pseudo:"Jen",verifiedSecret:"group-hash",now:2}).state;
 return {rooms:{miss2027:{gameId:"g1",tour:1,votesOpen:false,connectionsOpen:true}},events:{miss2027:{registration:reg,players:{u2:{groupId:"g"}},votes:{u2:{tour1:[1,2],favorite:1}}}}};
};
const recover=(root,extra={})=>authenticateGroupMember({read:async()=>root,matches:async(p,s)=>p==="group-password"&&s==="group-hash",requesterUid:"new",pseudo:" JÉN ",password:"group-password",adminUid:"admin",...extra});
test("existing private member keeps original identity and votes using the group password",async()=>{
 const root=fixture(),saved=structuredClone(root);
 root.rooms.miss2027.registrationLocked=true;
 const result=await recover(root);
 assert.deepEqual(result.result,{uid:"u2"});
 assert.equal(gameView(root,result.result.uid).result.ownVote.favorite,1);
 assert.deepEqual(root.events,saved.events);
 assert.equal((await recover(root,{pseudo:"Rod"})).result.uid,"u1");
 assert.equal(membershipView(root.events.miss2027.registration,"u1").isOwner,true);
 assert.equal((await recover(root,{requesterUid:"u2"})).result.uid,"u2");
});
test("wrong password, nonexistent pseudo, admin and public rooms cannot recover",async()=>{
 const root=fixture();
 assert.equal((await recover(root,{password:"bad"})).code,"recovery_invalid");
 assert.equal((await recover(root,{pseudo:"Unknown"})).code,"recovery_invalid");
 assert.equal((await recover(root,{requesterUid:"u1"})).code,"already_member");
 assert.equal((await recover(root,{requesterUid:"admin"})).code,"recovery_invalid");
 assert.equal((await recover(root,{adminUid:"u2"})).code,"recovery_invalid");
 const pub=registerPublic(root,{uid:"pub",pseudo:"Public",now:4}).state;
 assert.equal((await recover(pub,{pseudo:"Public"})).code,"recovery_invalid");
});
test("game reset preserves private recovery, registration reset or concurrent removal denies it",async()=>{
 const root=fixture(),reset=resetContest(root,"game","g2").state;
 assert.equal((await recover(reset)).result.uid,"u2");
 const cleared=resetContest(reset,"registrations","g3").state;
 assert.equal((await recover(cleared)).code,"recovery_invalid");
 let reads=0;
 assert.equal((await recover(root,{read:async()=>++reads===1?root:cleared})).code,"recovery_invalid");
});
