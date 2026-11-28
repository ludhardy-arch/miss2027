import React from "react";

const LIMIT=3;
function PeopleIcon(){return <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 4a3 3 0 0 1 0 6m4 10v-2a6 6 0 0 0-4-5.7"/></svg>}
function PlusIcon(){return <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>}
export default function WaitingGroups({groups=[],buttonStyle,onJoin,onCreate,pending=false,locked=false}){
 const count=groups.length;
 return <>
  {groups.map(group=><article key={group.id} className="waiting-group-card">
    <h2>Bienvenue {group.pseudo} dans le groupe {group.name} !</h2>
    <section className="waiting-group-roster">
      <h3>Participants ({group.memberCount??group.members?.length??0}/30)</h3>
      {(group.members||[]).map(member=><div key={member.id||member.pseudo} className="waiting-group-member"><span aria-hidden="true" style={{flexShrink:0,color:member.isOwner?"#ffe1a0":"#d7e8ff"}}>{member.isOwner?"♛":"●"}</span><span style={{minWidth:0}}>{member.pseudo}{member.isOwner?" · Créateur":""}</span></div>)}
    </section>
  </article>)}
  {count>0&&<p className="waiting-group-count">Tu appartiens à {count} groupe{count>1?"s":""} sur {LIMIT}</p>}
  {count>0&&count<LIMIT&&!locked&&<>
    <button type="button" className="group-entry-blue group-entry-neon waiting-group-action" style={buttonStyle} onClick={onJoin} disabled={pending||!onJoin}><PeopleIcon/><span>Rejoindre un {count===1?"deuxième":"troisième"} groupe</span></button>
    <button type="button" className="group-entry-blue group-entry-neon waiting-group-action" style={buttonStyle} onClick={onCreate} disabled={pending||!onCreate}><PlusIcon/><span>Créer un groupe supplémentaire</span></button>
    {(!onJoin||!onCreate)&&<p role="status" style={{color:"#b6c8e9",fontSize:12,textAlign:"center",margin:0}}>Groupes supplémentaires : en préparation sur le site test.</p>}
  </>}
 </>;
}
