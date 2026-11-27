import React from "react";
import "./InvitationPreview.css";
export default function InvitationCard({name,password,onJoin}){
 return <article className="miss-invite-card">
    <div className="miss-invite-crown"><img src="/images/couronne-prestige.svg" alt=""/></div>
    <div className="miss-invite-kicker">INVITATION À LA SOIRÉE</div>
    <h2>MISS FRANCE 2027</h2>
    <div className="miss-invite-date">Samedi 12 décembre à 21 h</div>
    <div className="miss-invite-opening">Ouverture de la salle à 20 h 40</div>
    <div className="miss-invite-goldline" aria-hidden="true"><i/></div>
    <div className="miss-invite-group">
     <div className="miss-invite-label">NOM DU GROUPE</div><h3>{name}</h3>
     {password&&<div className="miss-invite-password">Mot de passe du groupe : <strong>{password}</strong></div>}
    </div>
    <button type="button" className="miss-invite-green" onClick={onJoin}>JE REJOINS MES AMIS</button>
    <p className="miss-invite-caption">Choisis ton pseudo et c'est parti !</p>
   </article>;
}
