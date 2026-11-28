import React,{useCallback,useState} from "react";
import {createPortal} from "react-dom";
import ChatBubble from "./ChatBubble";
function Conversation({group,user,request,open,header,onUnread}){
 const send=useCallback((body,cursor)=>body===undefined?request("/chat?"+new URLSearchParams({groupId:group.id,...(cursor||{})})):request("/chat",{...body,groupId:group.id}),[group.id,request]);
 const changed=useCallback(n=>onUnread(group.id,n),[group.id,onUnread]);
 return <ChatBubble user={user} groupRequest={send} roomId={group.id} groupName={group.name} externalOpen={open} hideBubble onUnread={changed} headerExtra={header}/>;
}
export default function MultiGroupChat({user,groups,request}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(null),[unread,setUnread]=useState({});
 const active=groups.find(g=>g.id===selected)||groups[0];
 const update=useCallback((id,n)=>setUnread(old=>old[id]===n?old:{...old,[id]:n}),[]);
 const total=groups.reduce((n,g)=>n+(unread[g.id]||0),0);
 if(!active)return null;
 const header=groups.length>1?<div style={{padding:8,display:"grid",gap:5,background:"#101e43"}}><div style={{color:"#ffe1a0",fontWeight:700,textAlign:"center"}}>Mes conversations</div>{groups.map(g=><button key={g.id} type="button" onClick={()=>setSelected(g.id)} style={{width:"100%",margin:0,minHeight:32,padding:"6px 10px",fontSize:13,textAlign:"left",display:"flex",justifyContent:"space-between",background:active.id===g.id?"#254c8c":"#142447",border:"1px solid #577fb9",borderRadius:8,color:"#fff",boxShadow:"none"}}><span>{g.name}</span>{unread[g.id]>0&&<b style={{color:"#ff9aa6"}}>{unread[g.id]}</b>}</button>)}</div>:null;
 return <>{groups.map(g=><Conversation key={user.uid+":"+g.id} group={g} user={user} request={request} open={open&&g.id===active.id} header={header} onUnread={update}/>)}{createPortal(<button type="button" aria-label={open?"Fermer le chat":"Ouvrir le chat"} onClick={()=>setOpen(v=>!v)} style={{position:"fixed",bottom:20,right:20,width:55,height:55,minHeight:55,padding:0,margin:0,border:0,borderRadius:"50%",background:"#ff4da6",color:"white",zIndex:2147483647,boxShadow:"0 4px 14px #0006",fontSize:22}}>💬{total>0&&!open&&<span style={{position:"absolute",top:-2,right:-2,borderRadius:20,padding:"2px 6px",background:"red",color:"white",fontSize:12,fontWeight:700}}>{total}</span>}</button>,document.body)}</>;
}
