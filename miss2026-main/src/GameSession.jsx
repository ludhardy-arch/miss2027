import React,{useContext,useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {AppContext} from "./context/AppContext";
import {auth} from "./firebase";
import Player from "./pages/Player";
import Waiting from "./pages/Waiting";
import ChatBubble from "./components/ChatBubble";
import FinalShow from "./components/FinaleOverlay";
const roomChat=body=>request("/chat",body);

const API="https://miss2027-test-api.onrender.com";
const errors={not_registered:"Inscription introuvable. Retourne à l’accueil.",game_changed:"La partie a été réinitialisée.",round_changed:"Le tour a changé.",votes_closed:"Les votes sont fermés.",invalid_vote:"Sélection non valide.",invalid_favorite:"Choisis ton coup de cœur parmi les 12 Miss.",already_voted:"Ton vote est déjà enregistré.",chat_blocked:"Ton accès au chat est bloqué.",invalid_message:"Message invalide (500 caractères maximum).",too_many_requests:"Trop de demandes. Réessaie dans un instant."};
async function request(path,body){
 const user=auth.currentUser;
 if(window.location.origin!=="https://miss2027-test.onrender.com"||!user)throw Error("Session test indisponible.");
 const token=await user.getIdToken();
 const res=await fetch(API+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000),cache:"no-store"});
 const data=await res.json();
 if(!res.ok)throw Object.assign(Error(errors[data.error]||"Serveur temporairement indisponible."),{code:data.error});
 if(auth.currentUser?.uid!==user.uid)throw Error("La session a changé.");
 return data;
}

export default function GameSession({user,setUser,waiting}){
 const national=useContext(AppContext),navigate=useNavigate();
 const [view,setView]=useState(null),[failure,setFailure]=useState("");
 const serial=useRef(0),alive=useRef(false),missing=useRef(0);
 const leave=()=>{try{sessionStorage.setItem("miss_manual_exit",user.uid);}catch{}setUser(null);navigate("/login",{replace:true});};
 async function refresh(){
   const seq=++serial.current;
   try{
     const data=await request("/game/state");
     if(!alive.current||seq!==serial.current)return;
     if(data.group?.id!==user.groupId){setFailure("Vérification de ton inscription en cours…");return;}
     missing.current=0;
     if(data.gameId!==user.gameId){setView(null);setUser(old=>({...old,gameId:data.gameId}));return;}
     setView(data);setFailure("");
   }catch(e){
     if(!alive.current||seq!==serial.current)return;
     if(e.code==="not_registered"){
       if(++missing.current>=2){setFailure("Inscription introuvable après vérification. Réessaie ou retourne volontairement à l’accueil.");}
       else setFailure("Vérification de ton inscription en cours…");
       return;
     }
     setFailure(e.message);
   }
 }
 useEffect(()=>{
   alive.current=true;missing.current=0;setView(null);setFailure("");void refresh();
   const timer=setInterval(()=>{if(document.visibilityState!=="hidden")void refresh();},20000);
   const visible=()=>{if(document.visibilityState==="visible")void refresh();};
   document.addEventListener("visibilitychange",visible);
   window.addEventListener("online",visible);
   return()=>{alive.current=false;serial.current++;clearInterval(timer);document.removeEventListener("visibilitychange",visible);window.removeEventListener("online",visible);};
 },[user.uid,user.groupId,user.gameId]);
 // Refresh immediately whenever the national controls accessible to players change.
 useEffect(()=>{if(alive.current&&view&&(national.tour!==view.tour||national.finaleStarted!==view.finaleStarted||national.votesOpen!==view.votesOpen))void refresh();},[national.tour,national.finaleStarted,national.votesOpen]);
 async function vote(tour,selection,favorite){
   if(!view||failure)throw Error("Connexion en cours. Réessaie.");
   const result=await request("/game/vote",{gameId:view.gameId,tour,selection,...(tour===1?{favorite}:{})});
   if(result.accepted!==true)throw Error("Le vote n’a pas été confirmé.");
   setView(old=>old?.gameId===view.gameId?{...old,ownVote:{...old.ownVote,["tour"+tour]:selection,...(tour===1?{favorite}:{})}}:old);
   await refresh();
 }
 if(!view)return <main className="tv-page"><p role="status">{failure||"Connexion à ton groupe…"}</p>{failure&&<button onClick={()=>void refresh()}>Réessayer</button>}<button onClick={leave}>Retour à l’accueil</button></main>;
 const context={...national,tour:view.tour,votesOpen:view.votesOpen&&!failure,adminSelections:view.adminSelections,gameId:view.gameId,players:{[user.pseudo]:view.ownVote},groupTrend:view.trend,updateFirstRoundWithFavorite:(_pseudo,selection,favorite)=>vote(1,selection,favorite),updatePlayerVote:(_pseudo,tour,selection)=>vote(tour,selection)};
 return <AppContext.Provider value={context}>
   {failure&&<p role="alert" style={{textAlign:"center",color:"#ffb3b3"}}>{failure} <button onClick={()=>void refresh()}>Réessayer</button></p>}
   {view.finaleStarted?(view.final?<FinalShow frozenRanking={view.final.local} national={view.final} groupName={view.group.name} showKey={"miss2027-show-"+view.final.version+"-"+user.uid}/>:<main className="tv-page tv-show-v3"><h2>Le show final arrive !</h2><p>Résultats en attente.</p><button onClick={()=>void refresh()}>Actualiser</button></main>):waiting?<Waiting user={user}/>:<Player user={user} setUser={setUser}/>}
   {!view.finaleStarted&&<ChatBubble key={user.groupId} user={user} groupRequest={roomChat} groupName={view.group.name}/>}
 </AppContext.Provider>;
}
