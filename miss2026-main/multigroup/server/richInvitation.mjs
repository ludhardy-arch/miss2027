import {invitationDigest,openInvitation} from "./invitationCard.mjs";
import {invitationView} from "./management.mjs";
const ORIGIN="https://miss2027-test.onrender.com";
const IMAGE=ORIGIN+"/images/invitation-link-preview-v1.png";
export const previewToken=path=>/^\/invitation\/v3\/([a-f0-9]{64})$/.exec(path)?.[1]||null;
const escape=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
export function previewDetails(root,key,token){
 if(!/^[a-f0-9]{64}$/.test(token||""))return null;
 const digest=invitationDigest(token),view=invitationView(root,digest);
 if(view.code)return null;
 const {id,name}=view.result.group;
 const group=root.events.miss2027.registration.groups[id];
 if(group.inviteCard?.digest!==digest)return null;
 const card=openInvitation(key,group.inviteCard,{groupId:id,ownerUid:group.ownerUid});
 return card&&card.token===token?{name,password:card.password}:null;
}
export function previewPage(token,details=null){
 if(!/^[a-f0-9]{64}$/.test(token||""))throw Error("Invalid invitation");
 const target=ORIGIN+"/#/login?invite="+token;
 // Both labels belong in og:title: iMessage often omits og:description entirely.
 // Deliberately share only the group credentials with the invitation bearer, never the personal UID.
 const title=details?escape("👥 Groupe : "+details.name)+"&#10;"+escape("🔑 Mot de passe : "+details.password):"Invitation à la soirée Miss France 2027";
 return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow,noarchive">
<title>${title}</title><meta property="og:type" content="website"><meta property="og:site_name" content="Miss France 2027">
<meta property="og:title" content="${title}"><meta property="og:image" content="${IMAGE}">
<meta property="og:image:secure_url" content="${IMAGE}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="480"><meta property="og:image:height" content="252">
<meta property="og:image:alt" content="Invitation Miss France 2027">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:image" content="${IMAGE}">
<style>body{font:17px system-ui,sans-serif;background:#0a1533;color:white;text-align:center;margin:0;padding:24px}main{max-width:600px;margin:5vh auto}img{display:block;width:100%;border-radius:14px}a{display:block;padding:16px;margin-top:20px;border-radius:12px;background:#006f42;color:white;text-decoration:none;font-weight:700}</style>
</head><body><main><img src="${IMAGE}" alt="Invitation Miss France 2027"><p>Ouverture de ton invitation…</p><a id="open" href="${target}">JE REJOINS MES AMIS</a></main>
<script>location.replace(document.getElementById("open").href);</script></body></html>`;
}
