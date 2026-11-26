import test from "node:test";
import assert from "node:assert/strict";
import {createGroup,joinGroup,PRIVATE_CAPACITY} from "./registration.mjs";
import {manageGroup,acceptInvitation} from "./management.mjs";
test("private group includes owner in 30 player cap; both join routes enforce it and removal frees a place",()=>{
 const digest="a".repeat(64);
 const creator={uid:"u0",id:"g",name:"G",pseudo:"Owner",secret:"hash",now:1};
 let registration=createGroup(null,creator).state;
 for(let i=1;i<PRIVATE_CAPACITY;i++){
  const next=joinGroup(registration,{uid:"u"+i,id:"g",pseudo:"Player "+i,verifiedSecret:"hash",now:2});
  assert.equal(next.result.id,"g");registration=next.state;
 }
 assert.equal(Object.keys(registration.groups.g.members).length,30);
 const newcomer={uid:"u30",id:"g",pseudo:"New",verifiedSecret:"hash",now:3};
 assert.equal(joinGroup(registration,newcomer).code,"group_full");
 let root={rooms:{miss2027:{tour:1}},events:{miss2027:{registration}}};
 assert.equal(manageGroup(root,{uid:"u0",action:"rename",value:"Other"}).code,"invalid_action");
 assert.equal(manageGroup(root,{uid:"u0",action:"open",value:false}).code,"invalid_action");
 root=manageGroup(root,{uid:"u0",action:"invite",digest}).state;
 assert.equal(acceptInvitation(root,{...newcomer,digest}).code,"group_full");
 root=manageGroup(root,{uid:"u0",action:"remove",targetUid:"u1"}).state;
 assert.equal(acceptInvitation(root,{...newcomer,digest}).result.group.memberCount,30);
});
