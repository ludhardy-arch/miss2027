import test from "node:test";
import assert from "node:assert/strict";
import {TEST_ORIGIN,testPlayerAppName,testPlayerUrl,adminSessionUrl,isAdminSession,sessionAppName,ADMIN_APP_NAME,authorizedAdmin} from "../../src/testPlayerSession.mjs";
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

test("admin has dedicated persistent namespace, isolated from normal and simulated players",()=>{
 const admin=adminSessionUrl(testPlayerUrl(TEST_ORIGIN,a));
 assert.equal(admin,TEST_ORIGIN+"/?regie=1#/admin");
 assert.equal(sessionAppName(admin),ADMIN_APP_NAME);
 assert.equal(sessionAppName(admin.replace("#/admin","#/login")),ADMIN_APP_NAME);
 assert.equal(sessionAppName(admin.replace("#/admin","#/demo")),ADMIN_APP_NAME);
 assert.equal(sessionAppName(TEST_ORIGIN+"/#/login"),undefined);
 assert.notEqual(sessionAppName(testPlayerUrl(admin,a)),ADMIN_APP_NAME);
 assert.notEqual(sessionAppName(testPlayerUrl(admin,a)),sessionAppName(testPlayerUrl(admin,b)));
 assert.equal(isAdminSession(TEST_ORIGIN+"/?testPlayer="+a+"#/admin"),false);
 assert.equal(testPlayerAppName(TEST_ORIGIN+"/?regie=1&testPlayer="+a),undefined);
 assert.equal(adminSessionUrl("https://miss2027.onrender.com"),null);
});
test("admin recovery never accepts player, anonymous or custom-token identity",()=>{
 assert.equal(authorizedAdmin({uid:"a",isAnonymous:false},"a","google.com"),true);
 assert.equal(authorizedAdmin({uid:"p",isAnonymous:false},"a","google.com"),false);
 assert.equal(authorizedAdmin({uid:"a",isAnonymous:true},"a","google.com"),false);
 assert.equal(authorizedAdmin({uid:"a",isAnonymous:false},"a","custom"),false);
 assert.equal(authorizedAdmin(null,"a","google.com"),false);
});
