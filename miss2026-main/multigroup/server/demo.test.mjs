import test from "node:test";
import assert from "node:assert/strict";
import {QUALIFIED,FINALISTS,OFFICIAL,demoVote,demoRecords,demoResult,memoryDraftStore} from "../../src/pages/demoModel.mjs";
test("demo uses the official scoring and ranking with fictional players, no persistent votes",()=>{
 let ballot=demoVote({},1,QUALIFIED,OFFICIAL[0]);
 assert.equal(demoRecords(1,ballot,false).Camille.tour1,undefined);
 assert.equal(demoRecords(1,ballot,true).Camille.tour1.length,12);
 assert.throws(()=>demoVote(ballot,1,QUALIFIED,OFFICIAL[0]));
 ballot=demoVote(ballot,2,FINALISTS);ballot=demoVote(ballot,3,OFFICIAL);
 const result=demoResult(ballot);
 assert.equal(result.personal.points,401);assert.equal(result.nationalTotal,7);
 assert.equal(result.local.length,7);assert.equal(result.personal.nationalRank,1);
});
test("demo rejects incomplete or impossible predictions and drafts never escape their memory store",()=>{
 assert.throws(()=>demoVote({},1,QUALIFIED,2));
 assert.throws(()=>demoVote({},2,FINALISTS));
 const b=demoVote({},1,QUALIFIED,5);
 assert.throws(()=>demoVote(b,2,[1,2,3,4,5]));
 const a=memoryDraftStore(),c=memoryDraftStore();a.setItem("draft","[1]");
 assert.equal(a.getItem("draft"),"[1]");assert.equal(c.getItem("draft"),null);
});
