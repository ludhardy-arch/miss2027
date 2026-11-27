import React,{useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import "./InvitationPreview.css";

export default function InvitationPreview({group,existingLink,prepare,onClose,onStale}){
 const [password,setPassword]=useState(""),[link,setLink]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState("");
 const active=useRef(true),inFlight=useRef(false),panel=useRef(null);
 useEffect(()=>{active.current=true;const previous=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.focus();return()=>{active.current=false;document.body.style.overflow=previous;};},[]);
 const message=()=>["INVITATION À LA SOIRÉE MISS FRANCE 2027","Samedi 12 décembre à 21 h","Ouverture de la salle à 20 h 40","","Nom du groupe : "+group.name,"Mot de passe du groupe : "+password,"","JE REJOINS MES AMIS","Choisis ton pseudo et c’est parti !"].join("\n");
 async function generate(event){
  event.preventDefault();if(inFlight.current||password.length<6)return;
  if(group.invitationActive&&!existingLink&&!window.confirm("Créer un nouveau lien ? Le précédent ne fonctionnera plus."))return;
  inFlight.current=true;setBusy(true);setError("");setStatus("");
  try{const result=await prepare(password,existingLink);if(active.current){setLink(result);setStatus("Invitation prête à partager.");}}
  catch(e){if(active.current){setError(e.message);if(e.code==="invitation_changed")onStale();}}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 async function copy(){
  if(!link)return;
  try{await navigator.clipboard.writeText(message()+"\n"+link);setStatus("Invitation copiée !");}
  catch{setStatus("Copie manuellement le message et le lien ci-dessous.");}
 }
 async function share(){
  if(!link)return;setStatus("");
  try{if(navigator.share)await navigator.share({title:"Invitation à la soirée Miss France 2027",text:message(),url:link});else await copy();}
  catch(e){if(e.name!=="AbortError")await copy();}
 }
 return createPortal(<div className="miss-invite-overlay"><section className="miss-invite-panel" role="dialog" aria-modal="true" aria-label="Préparer mon invitation" tabIndex={-1} ref={panel} onKeyDown={e=>{if(e.key==="Escape"&&!busy)onClose();}}>
  <header className="miss-invite-top"><strong>Mon invitation</strong><button type="button" onClick={onClose} disabled={busy} aria-label="Fermer l’aperçu">✕</button></header>
  <form onSubmit={generate}>
   <article className="miss-invite-card">
    <div className="miss-invite-crown"><img src="/images/couronne-prestige.svg" alt=""/></div>
    <div className="miss-invite-kicker">INVITATION À LA SOIRÉE</div>
    <h2>MISS FRANCE 2027</h2>
    <div className="miss-invite-date">Samedi 12 décembre à 21 h</div>
    <div className="miss-invite-opening">Ouverture de la salle à 20 h 40</div>
    <div className="miss-invite-goldline" aria-hidden="true"><i/></div>
    <div className="miss-invite-group">
     <div className="miss-invite-label">NOM DU GROUPE</div><h3>{group.name}</h3>
     <div className="miss-invite-password">{link?<span>Mot de passe du groupe : <strong>{password}</strong></span>:<label>Mot de passe du groupe :<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={6} maxLength={128} required placeholder="Saisis le mot de passe" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} disabled={busy}/></label>}</div>
    </div>
    <div className="miss-invite-green" aria-label="Aperçu du bouton de l’invité">JE REJOINS MES AMIS</div>
    <p className="miss-invite-caption">Choisis ton pseudo et c'est parti !</p>
   </article>
   {!link?<><p className="miss-invite-hint">Renseigne le mot de passe de ton groupe pour préparer l’invitation privée.</p><button className="miss-invite-action" disabled={busy||password.length<6} type="submit">{busy?"Préparation…":"Préparer mon invitation"}</button></>:<>
    <p className="miss-invite-hint">Partage uniquement avec les personnes que tu souhaites inviter.</p>
    <button type="button" className="miss-invite-action" onClick={share}>Partager mon invitation</button>
    <button type="button" className="miss-invite-secondary" onClick={copy}>Copier le message et le lien</button>
    <details><summary>Voir le message à envoyer</summary><textarea readOnly aria-label="Message d’invitation à copier" value={message()+"\n"+link} rows={10} onFocus={e=>e.target.select()}/></details>
   </>}
   {error&&<p role="alert" className="miss-invite-error">{error}</p>}{status&&<p role="status" className="miss-invite-status">{status}</p>}
  </form>
 </section></div>,document.body);
}
