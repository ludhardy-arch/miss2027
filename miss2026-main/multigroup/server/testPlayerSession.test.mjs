import test from "node:test";
import assert from "node:assert/strict";
import {TEST_ORIGIN,testPlayerAppName,testPlayerUrl} from "../../src/testPlayerSession.mjs";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
test("normal player keeps default Firebase app; simulated URLs use separate persistent namespaces",()=>{
 const first=testPlayerUrl(TEST_ORIGIN,a),second=testPlayerUrl(first,b);
 assert.equal(testPlayerAppName(TEST_ORIGIN+"/#/login"),undefined);
 assert.equal(testPlayerAppName(first),"test-player-"+a);
 assert.equal(testPlayerAppName(second),"test-player-"+b);
 assert.notEqual(testPlayerAppName(first),testPlayerAppName(second));
 assert.equal(testPlayerAppName(first.replace("#/login","#/player")),testPlayerAppName(first));
 assert.equal(testPlayerAppName(first.replace("#/login","#/waiting")),testPlayerAppName(first));
});
test("simulation is not enabled outside test origin or with arbitrary app names",()=>{
 assert.equal(testPlayerUrl("https://miss2027.onrender.com",a),null);
 assert.equal(testPlayerAppName("https://miss2027.onrender.com/?testPlayer="+a),undefined);
 assert.equal(testPlayerUrl(TEST_ORIGIN,"default"),null);
 assert.equal(testPlayerAppName(TEST_ORIGIN+"/?testPlayer=default"),undefined);
});
