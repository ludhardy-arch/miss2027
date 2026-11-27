import React,{useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import "./InvitationPreview.css";
import {richInvitationLink} from "./invitationImage.mjs";
export default function InvitationPreview({group,load,onClose}){
 const [card,setCard]=useState(null),[passwordRequired,setPasswordRequired]=useState(false),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(true),[status,setStatus]=useState(""),[error,setError]=useState("");
 const [fallback,setFallback]=useState(false);
 const active=useRef(true),inFlight=useRef(false),panel=useRef(null),loadRef=useRef(load);loadRef.current=load;
 const count=Math.min(30,Math.max(0,Number(group.memberCount)||0)),remaining=30-count;
 const blocked=remaining===0||group.locked;
 async function getCard(pw){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");setStatus("");setFallback(false);
  try{
   const result=await loadRef.current(pw);
   if(active.current){setPasswordRequired(!!result.passwordRequired);setCard(result.passwordRequired?null:result);setPassword("");}
  }
  catch(e){if(active.current)setError(e.message||"Invitation indisponible.");}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 useEffect(()=>{active.current=true;const previous=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.focus();if(!blocked)void getCard();else setBusy(false);
 return()=>{active.current=false;document.body.style.overflow=previous;};},[group.id]);
 const rich=()=>richInvitationLink(card.link);
 const sharing=useRef(false);
 async function copyFallback(){
  if(!card||blocked)return;
  try{await navigator.clipboard.writeText(rich());setStatus("Lien copié !");}
  catch{setStatus("Sélectionne le lien ci-dessous pour le copier.");}
 }
 function share(){
  if(!card||blocked||busy||sharing.current)return;
  setStatus("");setFallback(false);
  if(!navigator.share){setFallback(true);return;}
  try{
   const url=rich();sharing.current=true;
   navigator.share({url}).catch(e=>{
    if(e.name!=="AbortError"&&active.current){setStatus("Partage indisponible sur cet appareil.");setFallback(true);}
   }).finally(()=>{sharing.current=false;});
  }catch{sharing.current=false;setStatus("Partage indisponible sur cet appareil.");setFallback(true);}
 }
 return createPortal(<div className="miss-invite-overlay"><section className="miss-invite-panel miss-invite-menu" role="dialog" aria-modal="true" aria-label="Inviter mes amis" tabIndex={-1} ref={panel} onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <header className="miss-invite-top"><h2>Inviter mes amis</h2><button className="miss-invite-close" type="button" onClick={onClose} aria-label="Fermer"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
  <div className="miss-invite-capacity"><strong>♟ {count} participant{count>1?"s":""} sur 30</strong><div className="miss-invite-track" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={count}><i style={{width:(count/30*100)+"%"}}/></div><span>{remaining?remaining+" place"+(remaining>1?"s":"")+" encore disponible"+(remaining>1?"s":""):"Groupe complet"}</span></div>
  {group.locked&&<p className="miss-invite-error">Les inscriptions sont fermées.</p>}
  {busy&&!blocked&&<p role="status" className="miss-invite-hint">Préparation de l’invitation…</p>}
  {passwordRequired&&!blocked&&<form onSubmit={e=>{e.preventDefault();if(password.length>=6)void getCard(password);}}><p className="miss-invite-hint">Pour ce groupe créé avant la nouvelle invitation, confirme une seule fois son mot de passe.</p><input className="miss-invite-secret" type="password" aria-label="Mot de passe du groupe" autoComplete="off" autoCapitalize="none" minLength={6} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button className="miss-invite-action" type="submit" disabled={busy||password.length<6}>Confirmer le mot de passe</button></form>}
  <div className="miss-invite-channels"><button className="miss-invite-channel" type="button" style={{background:"linear-gradient(110deg,#b94b24 0%,#c52c68 48%,#8136bd 100%)",border:"2px solid #ff9acf",boxShadow:"0 0 9px rgba(255,115,181,.8),0 0 22px rgba(229,54,147,.38)",color:"#fff"}} disabled={!card||blocked||busy} onClick={share}><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg><span>Partager mon invitation</span><span aria-hidden="true">›</span></button></div>
  {error&&<><p role="alert" className="miss-invite-error">{error}</p>{!passwordRequired&&!blocked&&<button type="button" className="miss-invite-secondary" disabled={busy} onClick={()=>void getCard()}>Réessayer</button>}</>}
  {fallback&&card&&!blocked&&!busy&&<div><button type="button" className="miss-invite-secondary" onClick={copyFallback}>Copier le lien</button><textarea readOnly value={rich()} rows={3} aria-label="Lien privé" onFocus={e=>e.target.select()}/></div>}
  {status&&<p role="status" className="miss-invite-status">{status}</p>}
  <button type="button" className="miss-invite-cancel" onClick={onClose}>Annuler</button>
 </section></div>,document.body);
}
