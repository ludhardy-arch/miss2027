import test from "node:test";
import assert from "node:assert/strict";
import {invitationMessage,invitationText,wrapText} from "../../src/components/invitationImage.mjs";
test("short message contains the unchanged private invitation URL exactly once",()=>{
 const link="https://miss2027-test.onrender.com/#/login?invite="+"a".repeat(64);
 const value=invitationMessage("St aubin",link);
 assert.equal(value.split(link).length,2);
 assert.ok(value.includes("St aubin"));
 assert.ok(!value.includes("Mot de passe"));
 assert.ok(invitationText("St aubin","private-test",link).includes(link));
});
test("long names and passwords are wrapped without dropping characters",()=>{
 const value="Équipe des amis & famille "+"🙂".repeat(16);
 const lines=wrapText(value,s=>Array.from(s).length,12);
 assert.equal(lines.join(""),value);
 assert.ok(lines.every(line=>Array.from(line).length<=12));
});
