import test from "node:test";
import assert from "node:assert/strict";
import {createGroup,groupNameAvailable} from "./registration.mjs";
import {resetContest} from "./reset.mjs";
test("group name availability rejects duplicates regardless of case, accents or spaces",()=>{
 const data={uid:"u1",id:"g1",name:"Les Étoiles",pseudo:"Alice",secret:"hash",now:1};
 const s=createGroup(null,data).state;
 assert.equal(groupNameAvailable(s," les  ETOILES "),false);
 assert.equal(groupNameAvailable(s,"Les Étoiles 2"),true);
 assert.equal(createGroup(s,{...data,uid:"u2",id:"g2",name:"LES ETOILES",pseudo:"Bob"}).code,"group_name_taken");
 assert.equal(createGroup(s,{...data,uid:"u2",id:"g2",name:"Les Étoiles 2",pseudo:"Bob"}).result.name,"Les Étoiles 2");
 assert.equal(groupNameAvailable(s,"Salle publique 19"),false);
 assert.equal(groupNameAvailable(s," "),false);
 const root={rooms:{miss2027:{gameId:"g",tour:1}},events:{miss2027:{registration:s}}};
 assert.equal(groupNameAvailable(resetContest(root,"game","g2").state.events.miss2027.registration,"Les Étoiles"),false);
 assert.equal(groupNameAvailable(resetContest(root,"registrations","r").state.events.miss2027.registration,"Les Étoiles"),true);
});
