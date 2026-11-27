import React,{useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import "./InvitationPreview.css";
import {createInvitationImage,invitationMessage,invitationText,richInvitationLink} from "./invitationImage.mjs";
export default function InvitationPreview({group,load,onClose}){
 const [card,setCard]=useState(null),[passwordRequired,setPasswordRequired]=useState(false),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(true),[status,setStatus]=useState(""),[error,setError]=useState("");
 const [imageFile,setImageFile]=useState(null),[imageNotice,setImageNotice]=useState("");
 const active=useRef(true),inFlight=useRef(false),panel=useRef(null),loadRef=useRef(load);loadRef.current=load;
 const count=Math.min(30,Math.max(0,Number(group.memberCount)||0)),remaining=30-count;
 const blocked=remaining===0||group.locked;
 async function getCard(pw){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");setStatus("");setImageFile(null);setImageNotice("");
  try{
   const result=await loadRef.current(pw);
   if(active.current){setPasswordRequired(!!result.passwordRequired);setCard(result.passwordRequired?null:result);setPassword("");}
   if(!result.passwordRequired){try{const file=await createInvitationImage({name:group.name,password:result.password});if(active.current)setImageFile(file);}catch{if(active.current)setImageNotice("Image indisponible : le partage du texte et du lien reste possible.");}}
  }
  catch(e){if(active.current)setError(e.message||"Invitation indisponible.");}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 useEffect(()=>{active.current=true;const previous=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.focus();if(!blocked)void getCard();else setBusy(false);
 return()=>{active.current=false;document.body.style.overflow=previous;};},[group.id]);
 const full=()=>invitationText(group.name,card.password,card.link);
 const short=()=>invitationMessage(group.name,card.link);
 const rich=()=>richInvitationLink(card.link);
 const sharing=useRef(false);
 function canShareImage(){
  try{return !!(imageFile&&navigator.share&&navigator.canShare&&navigator.canShare({files:[imageFile]}));}catch{return false;}
 }
 async function copy(linkOnly=false){
  if(!card||blocked)return;
  try{await navigator.clipboard.writeText(linkOnly?rich():full());setStatus(linkOnly?"Lien copié !":"Invitation copiée !");}
  catch{setStatus("Copie manuellement le message ou le lien ci-dessous.");}
 }
 function saveImage(){
  if(!imageFile||blocked)return;
  const url=URL.createObjectURL(imageFile),a=document.createElement("a");a.href=url;a.download=imageFile.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function shareText(channel){
  if(!card||blocked||busy)return;
  const text=full(),enc=encodeURIComponent;
  if(channel==="sms"){
   const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
   window.location.href="sms:"+(ios?"&":"?")+"body="+enc(text);return;
  }
  if(channel==="whatsapp"){window.open("https://wa.me/?text="+enc(text),"_blank","noopener,noreferrer");return;}
  if(channel==="mail"){window.location.href="mailto:?subject="+enc("Invitation à la soirée Miss France 2027")+"&body="+enc(text);return;}
  if(navigator.share){navigator.share({title:"Invitation à la soirée Miss France 2027",text}).catch(e=>{if(e.name!=="AbortError")setStatus("Partage indisponible. Copie l’invitation ci-dessous.");});}
  else void copy();
 }
 function shareImage(){
  if(!card||blocked||busy)return;
  setStatus("");
  if(canShareImage()){
   // Pre-rendered file: invoke directly in the user's tap, without awaiting a network request.
   // The OS chooses the app; the website cannot force Messages or a specific contact.
   const data={files:[imageFile],text:short()};
   navigator.share(data).then(()=>{setStatus("Partage terminé. Vérifie que le lien accompagne bien l’image.");}).catch(e=>{
    if(e.name!=="AbortError")setStatus("L’application n’a pas accepté le partage avec image. Utilise le partage texte ci-dessous, ou enregistre l’image et copie le lien.");
   });
   return;
  }
  if(navigator.share){shareText("native");}else{void copy();}
 }
 function share(){
  if(!card||blocked||busy||sharing.current)return;
  setStatus("");
  if(!navigator.share){void copy(true);return;}
  try{
   const url=rich();
   sharing.current=true;
   // Only ONE URL, no title, no text, no file attachment: Messages can render its link card.
   navigator.share({url}).catch(e=>{if(e.name!=="AbortError")setStatus("Partage indisponible. Utilise « Copier le lien » ou les autres options.");}).finally(()=>{sharing.current=false;});
  }catch{sharing.current=false;setStatus("Partage indisponible. Réessaie ou utilise les autres options.");}
 }
 return createPortal(<div className="miss-invite-overlay"><section className="miss-invite-panel miss-invite-menu" role="dialog" aria-modal="true" aria-label="Inviter mes amis" tabIndex={-1} ref={panel} onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <header className="miss-invite-top"><h2>Inviter mes amis</h2><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header>
  <div className="miss-invite-capacity"><strong>♟ {count} participant{count>1?"s":""} sur 30</strong><div className="miss-invite-track" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={count}><i style={{width:(count/30*100)+"%"}}/></div><span>{remaining?remaining+" place"+(remaining>1?"s":"")+" encore disponible"+(remaining>1?"s":""):"Groupe complet"}</span></div>
  {group.locked&&<p className="miss-invite-error">Les inscriptions sont fermées.</p>}
  {busy&&!blocked&&<p role="status" className="miss-invite-hint">Préparation de l’invitation…</p>}
  {passwordRequired&&!blocked&&<form onSubmit={e=>{e.preventDefault();if(password.length>=6)void getCard(password);}}><p className="miss-invite-hint">Pour ce groupe créé avant la nouvelle invitation, confirme une seule fois son mot de passe.</p><input className="miss-invite-secret" type="password" aria-label="Mot de passe du groupe" autoComplete="off" autoCapitalize="none" minLength={6} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button className="miss-invite-action" type="submit" disabled={busy||password.length<6}>Confirmer le mot de passe</button></form>}
  {card&&!blocked&&!busy&&<p className="miss-invite-hint">Un seul lien à partager, avec aperçu de l’invitation si ton application le permet.</p>}
  {imageNotice&&<p className="miss-invite-hint">{imageNotice}</p>}
  <div className="miss-invite-channels"><button className="miss-invite-channel" type="button" style={{background:"linear-gradient(110deg,#b94b24 0%,#c52c68 48%,#8136bd 100%)",border:"2px solid #ff9acf",boxShadow:"0 0 9px rgba(255,115,181,.8),0 0 22px rgba(229,54,147,.38)",color:"#fff"}} disabled={!card||blocked||busy} onClick={share}><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg><span>Partager mon invitation</span><span aria-hidden="true">›</span></button></div>
  {card&&!blocked&&!busy&&<p className="miss-invite-hint">Invitation privée : partage-la uniquement avec tes amis.</p>}
  {error&&<><p role="alert" className="miss-invite-error">{error}</p>{!passwordRequired&&!blocked&&<button type="button" className="miss-invite-secondary" disabled={busy} onClick={()=>void getCard()}>Réessayer</button>}</>}
  {card&&!blocked&&!busy&&<><button type="button" className="miss-invite-secondary" onClick={()=>copy(true)}>Copier le lien</button><details><summary>Autres options de partage</summary>{canShareImage()&&<button type="button" className="miss-invite-secondary" onClick={shareImage}>Partager l’image et le lien séparément</button>}{imageFile&&<button type="button" className="miss-invite-secondary" onClick={saveImage}>Enregistrer l’image</button>}<button type="button" className="miss-invite-secondary" onClick={()=>shareText("sms")}>Envoyer par SMS sans image</button><button type="button" className="miss-invite-secondary" onClick={()=>copy()}>Copier le message complet</button><textarea readOnly value={rich()} rows={3} aria-label="Lien privé" onFocus={e=>e.target.select()}/><textarea readOnly value={full()} rows={7} aria-label="Invitation privée" onFocus={e=>e.target.select()}/></details></>}
  {status&&<p role="status" className="miss-invite-status">{status}</p>}
  <button type="button" className="miss-invite-cancel" onClick={onClose}>Annuler</button>
 </section></div>,document.body);
}
