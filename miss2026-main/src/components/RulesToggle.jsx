import React from "react";

// Shared visual landmark for every rules/help disclosure.
// Keep the original home-page violet gradient, border and glow.
export default function RulesToggle({open,controls,onToggle,compact=false,children}){
  return <button type="button" aria-expanded={open} aria-controls={controls} onClick={onToggle}
    style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",boxSizing:"border-box",width:"100%",height:compact?52:74,minHeight:compact?52:74,padding:compact?"12px 34px":"18px 42px",borderRadius:13,border:"2px solid #e2a6ff",background:"linear-gradient(135deg,#512578,#8944b4,#512578)",color:"#fff",fontSize:compact?15:18,fontWeight:800,boxShadow:"0 0 6px #d88aff, 0 0 18px rgba(200,105,255,.75), 0 0 32px rgba(166,71,242,.42), inset 0 0 12px rgba(226,166,255,.28)"}}>
    {children}
    <span aria-hidden="true" style={{position:"absolute",right:compact?13:18,fontSize:20,lineHeight:1,transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform .18s ease"}}>⌄</span>
  </button>;
}
