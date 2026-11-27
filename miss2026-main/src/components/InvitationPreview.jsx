import React,{useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import "./InvitationPreview.css";
const channels=[
 {id:"sms",label:"SMS",color:"#259d50",symbol:"✉"},
 {id:"whatsapp",label:"WhatsApp",color:"#128c55",symbol:"☎"},
 {id:"facebook",label:"Facebook",color:"#1877f2",symbol:"f"},
 {id:"messenger",label:"Messenger",color:"#326dff",symbol:"ϟ"},
 {id:"mail",label:"E-mail",color:"#526d99",symbol:"@"}
];
export default function InvitationPreview({group,load,onClose}){
 const [card,setCard]=useState(null),[passwordRequired,setPasswordRequired]=useState(false),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(true),[status,setStatus]=useState(""),[error,setError]=useState("");
 const active=useRef(true),inFlight=useRef(false),panel=useRef(null),loadRef=useRef(load);loadRef.current=load;
 const count=Math.min(30,Math.max(0,Number(group.memberCount)||0)),remaining=30-count;
 const blocked=remaining===0||group.locked;
 async function getCard(pw){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");setStatus("");
  try{const result=await loadRef.current(pw);if(active.current){setPasswordRequired(!!result.passwordRequired);setCard(result.passwordRequired?null:result);setPassword("");}}
  catch(e){if(active.current)setError(e.message||"Invitation indisponible.");}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 useEffect(()=>{active.current=true;const previous=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.focus();if(!blocked)void getCard();else setBusy(false);
 return()=>{active.current=false;document.body.style.overflow=previous;};},[group.id]);
 const message=()=>["INVITATION À LA SOIRÉE MISS FRANCE 2027","Samedi 12 décembre à 21 h","Ouverture de la salle à 20 h 40","","Nom du groupe : "+group.name,"Mot de passe du groupe : "+card.password,"","JE REJOINS MES AMIS","Choisis ton pseudo et c’est parti !"].join("\n");
 const full=()=>message()+"\n"+card.link;
 async function copy(){
  if(!card||blocked)return;
  try{await navigator.clipboard.writeText(full());setStatus("Invitation copiée !");}
  catch{setStatus("Copie manuellement le message ci-dessous.");}
 }
 function share(channel){
  if(!card||blocked||busy)return;
  setStatus("");
  const text=full(),enc=encodeURIComponent;
  if(channel==="sms"){
   const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
   window.location.href="sms:"+(ios?"&":"?")+"body="+enc(text);return;
  }
  if(channel==="whatsapp"){window.open("https://wa.me/?text="+enc(text),"_blank","noopener,noreferrer");return;}
  if(channel==="mail"){window.location.href="mailto:?subject="+enc("Invitation à la soirée Miss France 2027")+"&body="+enc(text);return;}
  if(channel==="facebook"&&!window.confirm("Cette invitation contient les accès du groupe. Partage-la uniquement avec tes amis, jamais en public. Continuer ?"))return;
  if(navigator.share){
    // The system decides which installed messaging applications and recipient pickers are available.
    navigator.share({title:"Invitation à la soirée Miss France 2027",text:message(),url:card.link}).catch(e=>{if(e.name!=="AbortError"){setStatus("Le partage n’est pas disponible. Copie l’invitation, puis colle-la dans "+(channel==="facebook"?"Facebook":"Messenger")+".");}});
  }else{
    void copy();
    setStatus("Copie l’invitation puis colle-la dans "+(channel==="facebook"?"Facebook":"Messenger")+".");
  }
 }
 return createPortal(<div className="miss-invite-overlay"><section className="miss-invite-panel miss-invite-menu" role="dialog" aria-modal="true" aria-label="Inviter mes amis" tabIndex={-1} ref={panel} onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <header className="miss-invite-top"><h2>Inviter mes amis</h2><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header>
  <div className="miss-invite-capacity"><strong>♟ {count} participant{count>1?"s":""} sur 30</strong><div className="miss-invite-track" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={count}><i style={{width:(count/30*100)+"%"}}/></div><span>{remaining?remaining+" place"+(remaining>1?"s":"")+" encore disponible"+(remaining>1?"s":""):"Groupe complet"}</span></div>
  {group.locked&&<p className="miss-invite-error">Les inscriptions sont fermées.</p>}
  {busy&&!blocked&&<p role="status" className="miss-invite-hint">Préparation de l’invitation…</p>}
  {passwordRequired&&!blocked&&<form onSubmit={e=>{e.preventDefault();if(password.length>=6)void getCard(password);}}><p className="miss-invite-hint">Pour ce groupe créé avant la nouvelle invitation, confirme une seule fois son mot de passe.</p><input className="miss-invite-secret" type="password" aria-label="Mot de passe du groupe" autoComplete="off" autoCapitalize="none" minLength={6} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button className="miss-invite-action" type="submit" disabled={busy||password.length<6}>Confirmer le mot de passe</button></form>}
  <div className="miss-invite-channels">{channels.map(ch=><button key={ch.id} className="miss-invite-channel" type="button" style={{background:ch.color}} disabled={!card||blocked||busy} onClick={()=>share(ch.id)}><span className="miss-invite-symbol" aria-hidden="true">{ch.symbol}</span><span>Inviter par {ch.label}</span><span aria-hidden="true">›</span></button>)}</div>
  {error&&<><p role="alert" className="miss-invite-error">{error}</p>{!passwordRequired&&!blocked&&<button type="button" className="miss-invite-secondary" disabled={busy} onClick={()=>void getCard()}>Réessayer</button>}</>}
  {card&&!blocked&&<><button type="button" className="miss-invite-secondary" onClick={copy}>Copier l’invitation</button><details><summary>Message et lien à partager</summary><textarea readOnly value={full()} rows={9} aria-label="Invitation privée" onFocus={e=>e.target.select()}/></details></>}
  {status&&<p role="status" className="miss-invite-status">{status}</p>}
  <button type="button" className="miss-invite-cancel" onClick={onClose}>Annuler</button>
 </section></div>,document.body);
}
