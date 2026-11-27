import test from "node:test";
import assert from "node:assert/strict";
import {createGroup,joinGroup,searchGroups,registerPublic,membershipView,PUBLIC_CAPACITY} from "./registration.mjs";
const creator={uid:"u1",id:"g1",name:"La famille des Miss",pseudo:"Alice",secret:"opaque-hash",now:1};
const join={uid:"u2",id:"g1",pseudo:"Bob",verifiedSecret:"opaque-hash",now:2};
test("creator is a member and directory exposes only id and name",()=>{
 const r=createGroup(null,creator);
 assert.equal(r.state.membership.u1,"g1");
 assert.deepEqual(searchGroups(r.state,"FAMÍLLE"),[{id:"g1",name:creator.name}]);
 assert.equal(searchGroups(r.state,"famile").length,1);
 assert.equal(searchGroups(r.state,"zzzz").length,0);
});
test("one group per UID, no duplicate membership",()=>{
 const s=createGroup(null,creator).state;
 assert.equal(createGroup(s,{...creator,id:"g2"}).code,"already_member");
 const r=joinGroup(s,join);
 assert.equal(r.state.membership.u2,"g1");
 const retry=joinGroup(r.state,join);
 assert.equal(retry.result.alreadyRegistered,true);
 assert.equal(retry.result.group.pseudo,"Bob");
 assert.deepEqual(retry.state,r.state);
 assert.equal(joinGroup(r.state,{...join,uid:"other"}).code,"pseudo_taken");
 assert.equal(createGroup(r.state,{...creator,uid:"u2",id:"g2"}).code,"already_member");
});
test("invalid password is rejected; obsolete private closure no longer blocks registrations",()=>{
 const s=createGroup(null,creator).state;
 assert.equal(joinGroup(s,{...join,verifiedSecret:"wrong"}).code,"invalid_password");
 const closed={...s,groups:{g1:{...s.groups.g1,registrationsOpen:false}}};
 assert.equal(joinGroup(closed,join).result.id,"g1");
 assert.equal(searchGroups(closed,"famille").length,1);
});

const publicRoot=(registration={},open=true)=>({rooms:{miss2027:{connectionsOpen:open,demoEnabled:false}},events:{miss2027:{registration,control:{tour:1},keep:"preserved"}},unrelated:{keep:true}});
const publicPlayer=(i)=>({uid:"pub"+i,pseudo:"Joueur "+i,now:i});
test("61 public players fill rooms 30, 30 and 1 without touching unrelated data",()=>{
 let root=publicRoot();
 for(let i=1;i<=61;i++){const result=registerPublic(root,publicPlayer(i));assert.equal(result.result.group.type,"public");root=result.state;}
 const s=root.events.miss2027.registration;
 assert.deepEqual(Object.values(s.groups).map(g=>Object.keys(g.members).length),[30,30,1]);
 assert.equal(Object.keys(s.membership).length,61);
 assert.equal(PUBLIC_CAPACITY,30);
 assert.equal(membershipView(s,"pub31").name,"Salle publique 2");
 assert.deepEqual(root.unrelated,{keep:true});
 assert.equal(root.events.miss2027.keep,"preserved");
 assert.deepEqual(searchGroups(s,"Salle publique"),[]);
});
test("public allocation respects national opening and does not mutate closed room",()=>{
 const root=publicRoot({},false);
 assert.equal(registerPublic(root,publicPlayer(1)).code,"public_closed");
 assert.deepEqual(root.events.miss2027.registration,{});
});
test("public re-registration recovers existing membership without duplicating or renaming",()=>{
 const first=registerPublic(publicRoot(),publicPlayer(1));
 const second=registerPublic(first.state,{...publicPlayer(1),pseudo:"Different"});
 assert.equal(second.result.alreadyRegistered,true);
 assert.equal(second.result.group.pseudo,"Joueur 1");
 assert.deepEqual(second.state,first.state);
});
test("private and public use one shared membership index; private search never exposes public",()=>{
 const privateState=createGroup(null,creator).state;
 const privateAttempt=registerPublic(publicRoot(privateState),{uid:"u1",pseudo:"Alice",now:3});
 assert.equal(privateAttempt.result.group.id,"g1");
 assert.equal(privateAttempt.result.group.type,"private");
 assert.equal(privateAttempt.result.alreadyRegistered,true);
 const pub=registerPublic(privateAttempt.state,publicPlayer(1));
 const state=pub.state.events.miss2027.registration;
 assert.equal(createGroup(state,{...creator,uid:"pub1",id:"g2"}).code,"already_member");
 assert.equal(joinGroup(state,{...join,uid:"pub1"}).code,"already_member");
 assert.equal(joinGroup(state,{...join,id:"public-1",verifiedSecret:undefined}).code,"unavailable");
 assert.deepEqual(searchGroups(state,"famille"),[{id:"g1",name:creator.name}]);
});
