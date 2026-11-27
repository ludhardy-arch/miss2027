import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {richInvitationLink} from "../../src/components/invitationImage.mjs";
const token="a".repeat(64);
const origin="https://miss2027-test.onrender.com";
const html=readFileSync(new URL("../../public/invitation.html",import.meta.url),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
test("rich link keeps the original group token and dedicated test API",()=>{
 const old=origin+"/#/login?invite="+token;
 assert.equal(richInvitationLink(old),"https://miss2027-test-api.onrender.com/invitation/v3/"+token);
 assert.throws(()=>richInvitationLink(origin+"/#/login?invite=invalid"));
});
test("preview page redirects only to original group route",()=>{
 const elements={message:{},open:{}};
 let target;
 vm.runInNewContext(script,{URLSearchParams,location:{search:"?invite="+token,replace:v=>{target=v;}},document:{getElementById:id=>elements[id]}});
 assert.equal(target,"/#/login?invite="+token);
 assert.equal(elements.open.href,target);
 target=undefined;
 vm.runInNewContext(script,{URLSearchParams,location:{search:"?invite=https%3A%2F%2Fevil.example",replace:v=>{target=v;}},document:{getElementById:id=>elements[id]}});
 assert.equal(target,undefined);
});
test("public preview is generic and references a real PNG",()=>{
 assert.match(html,/property="og:image" content="https:\/\/miss2027-test\.onrender\.com\/images\/invitation-link-preview-v1\.png"/);
 const png=readFileSync(new URL("../../public/images/invitation-link-preview-v1.png",import.meta.url));
 assert.equal(png.readUInt32BE(16),480);
 assert.equal(png.readUInt32BE(20),252);
 assert.ok(!html.includes(token));
 assert.match(html,/name="referrer" content="no-referrer"/);
});

import {previewToken,previewDetails,previewPage} from "./richInvitation.mjs";
import {invitationKey,sealInvitation,openInvitation} from "./invitationCard.mjs";
test("personalized preview exposes only the matching invitation and escapes HTML",()=>{
 const key=invitationKey("test-only"),id="group-test",ownerUid="owner-test",password='a"<script>&b',name="Groupe <amis>";
 const inviteCard=sealInvitation(key,{groupId:id,ownerUid,password});
 const {token:real}=openInvitation(key,inviteCard,{groupId:id,ownerUid});
 const root={events:{miss2027:{registration:{groups:{[id]:{type:"private",name,ownerUid,inviteCard}}}}}};
 assert.deepEqual(previewDetails(root,key,real),{name,password});
 assert.equal(previewDetails(root,key,token),null);
 assert.equal(previewDetails({...root,rooms:{miss2027:{votesOpen:true}}},key,real),null);
 assert.equal(previewToken("/invitation/v3/"+real),real);
 assert.equal(previewToken("/invitation/v3/not-a-token"),null);
 const page=previewPage(real,{name,password});
 assert.ok(page.includes('property="og:title" content="👥 Groupe : Groupe &lt;amis&gt;&#10;🔑 Mot de passe : a&quot;&lt;script&gt;&amp;b"'));
 assert.ok(!page.includes(password));
 assert.ok(!page.includes(ownerUid));
 assert.ok(page.includes(origin+"/#/login?invite="+real));
 assert.ok(!previewPage(real).includes("Mot de passe :"));
 assert.throws(()=>previewPage("https://evil.example"));
});
