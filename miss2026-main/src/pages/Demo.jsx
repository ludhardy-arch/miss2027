import React,{useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {AppContext} from "../context/AppContext";
import Player from "./Player";
import Waiting from "./Waiting";
import FinalShow from "../components/FinaleOverlay";
import ChatBubble from "../components/ChatBubble";
import {DEMO_USER,QUALIFIED,FINALISTS,demoRecords,demoResult,demoVote,memoryDraftStore} from "./demoModel.mjs";

// The real presentation is shared. Every demo action and draft stays in memory.
// No live vote callbacks, chat endpoint or Firebase registration is used.
export default function Demo(){
 const navigate=useNavigate();
 const [tour,setTour]=useState(1),[waiting,setWaiting]=useState(false),[finished,setFinished]=useState(false),[run,setRun]=useState(0);
 const [ballots,setBallots]=useState({});
 const saved=useRef({}),drafts=useRef([memoryDraftStore()]);
 const initialChat=()=>[{author:"Camille",text:"Bienvenue dans la démo ! 👑"},{author:"Sophie",text:"À vous de choisir vos Miss !"}];
 const [messages,setMessages]=useState(initialChat);
 function exit(){navigate("/login",{replace:true});}
 function restart(){saved.current={};drafts.current=[memoryDraftStore()];setBallots({});setTour(1);setWaiting(false);setFinished(false);setRun(n=>n+1);setMessages(initialChat());window.scrollTo(0,0);}
 function save(t,selection,favorite){
  if(waiting||finished||t!==tour)throw Error("Ce tour de démonstration est terminé.");
  const next=demoVote(saved.current,t,selection,favorite);saved.current=next;setBallots(next);
 }
 function afterVote(){setWaiting(true);window.scrollTo(0,0);}
 function advance(){
  if(!saved.current["tour"+tour])return;
  if(tour===3)setFinished(true);else{setTour(t=>t+1);setWaiting(false);}
  window.scrollTo(0,0);
 }
 const context={
  tour,votesOpen:!waiting,players:demoRecords(tour,ballots,waiting),gameId:"demo-only-"+run,
  adminSelections:{tour1:tour>=2?QUALIFIED:[],tour2:tour>=3?FINALISTS:[],tour3:[]},
  updateFirstRoundWithFavorite:async(_pseudo,selection,favorite)=>save(1,selection,favorite),
  updatePlayerVote:async(_pseudo,t,selection)=>save(t,selection),
 };
 if(finished){
  const result=demoResult(ballots);
  return <AppContext.Provider value={context}><FinalShow key={"demo-"+run} frozenRanking={result.local} national={result} groupName="Démonstration · résultats fictifs" onDemoExit={exit} onDemoRestart={restart}/></AppContext.Provider>;
 }
 return <AppContext.Provider value={context}>
  <section style={{width:"min(94%,600px)",margin:"12px auto 0",boxSizing:"border-box",padding:"12px 14px",border:"1px solid #ddb979",borderRadius:14,background:"#142447",color:"#ffe6b4",textAlign:"center"}}>
    <strong style={{letterSpacing:".1em"}}>MODE DÉMO · TOUR {tour}</strong>
    <p style={{fontSize:13,margin:"5px 0 10px",color:"#e0e8ff"}}>Joueurs et résultats fictifs · aucun vote réel enregistré.</p>
    {waiting&&<button type="button" onClick={advance} style={{width:"100%",minHeight:48,border:"2px solid #46ff9b",borderRadius:12,background:"linear-gradient(135deg,#008743,#00a854)",color:"#fff",fontSize:16,fontWeight:800,marginBottom:8}}>{tour===3?"Découvrir le show final":"Passer au tour "+(tour+1)}</button>}
    <button type="button" onClick={exit} style={{background:"transparent",border:0,color:"#c6d3ee",fontSize:13,boxShadow:"none",minHeight:36}}>Retour à l’accueil</button>
  </section>
  {waiting?<Waiting user={DEMO_USER} demo/>:<Player key={run+":"+tour} user={DEMO_USER} demo demoDraftStores={drafts.current} onVoteComplete={afterVote} onDemoExit={exit}/>}
  <ChatBubble user={DEMO_USER} demoMessages={messages} groupName={DEMO_USER.groupName} onDemoSend={text=>setMessages(old=>[...old,{author:DEMO_USER.pseudo,text,date:Date.now()}])}/>
 </AppContext.Provider>;
}
