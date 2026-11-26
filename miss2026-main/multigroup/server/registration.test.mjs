import test from "node:test";
import assert from "node:assert/strict";
import {createGroup,joinGroup,searchGroups} from "./registration.mjs";
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
 assert.equal(joinGroup(r.state,join).code,"already_member");
 assert.equal(createGroup(r.state,{...creator,uid:"u2",id:"g2"}).code,"already_member");
});
test("closed group and stale or invalid password are rejected",()=>{
 const s=createGroup(null,creator).state;
 assert.equal(joinGroup(s,{...join,verifiedSecret:"wrong"}).code,"invalid_password");
 const closed={...s,groups:{g1:{...s.groups.g1,registrationsOpen:false}}};
 assert.equal(joinGroup(closed,join).code,"unavailable");
 assert.deepEqual(searchGroups(closed,"famille"),[]);
});
