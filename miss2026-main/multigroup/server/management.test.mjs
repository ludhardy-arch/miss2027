import test from "node:test";
import assert from "node:assert/strict";
import {manageGroup,invitationView,acceptInvitation,ownerView} from "./management.mjs";
const d="a".repeat(64),d2="b".repeat(64);
const root=()=>({rooms:{miss2027:{tour:1,votesOpen:false}},events:{miss2027:{registration:{groups:{g:{type:"private",name:"G",ownerUid:"u1",registrationsOpen:true,secret:"hash",members:{u1:{pseudo:"Owner"}}}},membership:{u1:"g"}}}}});
test("owner issues and rotates direct invitation, no secret exposed",()=>{
 let r=root();assert.equal(manageGroup(r,{uid:"x",action:"invite",digest:d}).code,"owner_required");
 r=manageGroup(r,{uid:"u1",action:"invite",digest:d}).state;
 assert.deepEqual(invitationView(r,d).result.group,{id:"g",name:"G"});
 r=manageGroup(r,{uid:"u1",action:"invite",digest:d2}).state;
 assert.equal(invitationView(r,d).code,"unavailable");
 r=acceptInvitation(r,{uid:"u2",digest:d2,pseudo:"A",now:1}).state;
 assert.equal(ownerView(r,"u1").result.group.memberCount,2);
 assert.equal(acceptInvitation(r,{uid:"u2",digest:d2,pseudo:"B",now:2}).result.alreadyRegistered,true);
 r=manageGroup(r,{uid:"u1",action:"remove",targetUid:"u2"}).state;
 assert.equal(ownerView(r,"u1").result.group.memberCount,1);
 r.rooms.miss2027.votesOpen=true;
 assert.equal(manageGroup(r,{uid:"u1",action:"remove",targetUid:"u1"}).code,"membership_locked");
 assert.equal(invitationView(r,d2).code,"unavailable");
});

test("owner UID alone authorizes management; members and strangers cannot manage",()=>{
 let r=root();
 r=manageGroup(r,{uid:"u1",action:"invite",digest:d}).state;
 r=acceptInvitation(r,{uid:"u2",digest:d,pseudo:"Participant",now:1}).state;
 for(const uid of ["u2","stranger"]){
   assert.equal(ownerView(r,uid).code,"owner_required");
   for(const action of ["invite","revoke","remove"])assert.equal(manageGroup(r,{uid,action,digest:d2,targetUid:"u1"}).code,"owner_required");
 }
 assert.equal(manageGroup(r,{uid:"u1",action:"remove",targetUid:"u1"}).code,"invalid_member");
 assert.equal(ownerView(r,"u1").result.group.isOwner,true);
 assert.equal(manageGroup(r,{uid:"u1",action:"remove",targetUid:"u2"}).result.group.memberCount,1);
});

import {removePlayer} from "./management.mjs";
import {membershipView,joinGroup,pseudoAvailable,registerPublic} from "./registration.mjs";
import {gameView,castVote,adminGameView} from "./game.mjs";
import {chatView} from "./chat.mjs";
test("regie removes exactly one player and votes during open voting; excludes re-registration",()=>{
 let r=root();r.rooms.miss2027.gameId="game";r=manageGroup(r,{uid:"u1",action:"invite",digest:d}).state;
 r=acceptInvitation(r,{uid:"u2",digest:d,pseudo:"Jen",now:1}).state;
 r=acceptInvitation(r,{uid:"u3",digest:d,pseudo:"Rod",now:2}).state;
 const e=r.events.miss2027;e.players={u2:{groupId:"g"},u3:{groupId:"g"}};e.votes={u2:{tour1:[1],favorite:1},u3:{tour1:[2],favorite:2}};e.chats={g:{m:{uid:"u3",text:"ok"}}};r.rooms.miss2027.votesOpen=true;
 const params={targetUid:"u2",groupId:"g",gameId:"game",confirmed:true,now:3};
 assert.equal(removePlayer(r,{...params,confirmed:false}).code,"confirmation_required");
 assert.equal(removePlayer(r,{...params,groupId:"other"}).code,"invalid_member");
 assert.equal(removePlayer(r,{...params,gameId:"old"}).code,"game_changed");
 const removed=removePlayer(r,params);assert.equal(removed.result.accepted,true);const next=removed.state,ev=next.events.miss2027;
 assert.equal(membershipView(ev.registration,"u2"),null);assert.equal(ev.votes.u2,undefined);
 assert.deepEqual(ev.votes.u3,e.votes.u3);assert.deepEqual(ev.chats,e.chats);
 assert.equal(adminGameView(next).players.u2,undefined);assert.equal(adminGameView(next).groups[0].memberCount,2);
 assert.equal(gameView(next,"u2").code,"player_removed");assert.equal(castVote(next,{uid:"u2"}).code,"player_removed");assert.equal(chatView(next,{uid:"u2"}).code,"not_registered");
 assert.equal(joinGroup(ev.registration,{uid:"u2",id:"g",pseudo:"New",verifiedSecret:"hash"}).code,"player_removed");
 assert.equal(pseudoAvailable(ev.registration,"JÉN","fresh"),false);
 assert.equal(acceptInvitation(next,{uid:"u2",digest:d,pseudo:"New"}).code,"player_removed");
 next.rooms.miss2027.connectionsOpen=true;assert.equal(registerPublic(next,{uid:"u2",pseudo:"New"}).code,"player_removed");
});
test("removing a creator transfers ownership, revokes invitation and preserves other members; published results are protected",()=>{
 let r=root();r.rooms.miss2027.gameId="game";r=manageGroup(r,{uid:"u1",action:"invite",digest:d}).state;
 r=acceptInvitation(r,{uid:"u2",digest:d,pseudo:"Jen",now:1}).state;
 r=acceptInvitation(r,{uid:"u3",digest:d,pseudo:"Rod",now:2}).state;
 const params={targetUid:"u1",groupId:"g",gameId:"game",confirmed:true,now:3};
 const out=removePlayer(r,params);assert.equal(ownerView(out.state,"u2").result.group.isOwner,true);
 assert.equal(invitationView(out.state,d).code,"unavailable");
 assert.equal(ownerView(out.state,"u2").result.group.memberCount,2);
 r.rooms.miss2027.finaleStarted=true;assert.equal(removePlayer(r,params).code,"game_finished");
});

test("prepared invitation verifies password and reuses current link without rotating",()=>{
 const r=root(),params={uid:"u1",action:"prepare_invite",digest:d,verifiedSecret:"hash"};
 assert.equal(manageGroup(r,{...params,verifiedSecret:"wrong"}).code,"invalid_password");
 assert.equal(manageGroup(r,{...params,uid:"stranger"}).code,"owner_required");
 const created=manageGroup(r,params);assert.equal(invitationView(created.state,d).result.group.name,"G");
 assert.equal(manageGroup(created.state,{...params,reuse:true}).state,created.state);
 assert.equal(manageGroup(created.state,{...params,digest:d2,reuse:true}).code,"invitation_changed");
 assert.equal(JSON.stringify(created.result).includes("hash"),false);
 assert.deepEqual(created.state.events.miss2027.registration.groups.g.members,r.events.miss2027.registration.groups.g.members);
});
