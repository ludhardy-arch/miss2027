import React,{useContext,useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {AppContext} from "./context/AppContext";
import {auth} from "./firebase";
import Player from "./pages/Player";
import Waiting from "./pages/Waiting";

const API="https://miss2027-test-api.onrender.com";
const errors={not_registered:"Inscription introuvable. Retourne à l’accueil.",game_changed:"La partie a été réinitialisée.",round_changed:"Le tour a changé.",votes_closed:"Les votes sont fermés.",invalid_vote:"Sélection non valide.",invalid_favorite:"Choisis ton coup de cœur parmi les 12 Miss.",already_voted:"Ton vote est déjà enregistré.",too_many_requests:"Trop de demandes. Réessaie dans un instant."};
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
 const serial=useRef(0),alive=useRef(false);
 const leave=()=>{setUser(null);navigate("/login",{replace:true});};
 async function refresh(){
   const seq=++serial.current;
   try{
     const data=await request("/game/state");
     if(!alive.current||seq!==serial.current)return;
     if(data.group?.id!==user.groupId||data.gameId!==user.gameId){leave();return;}
     setView(data);setFailure("");
   }catch(e){
     if(!alive.current||seq!==serial.current)return;
     if(e.code==="not_registered"){leave();return;}
     setFailure(e.message);
   }
 }
 useEffect(()=>{
   alive.current=true;setView(null);setFailure("");void refresh();
   const timer=setInterval(()=>{if(document.visibilityState!=="hidden")void refresh();},20000);
   const visible=()=>{if(document.visibilityState==="visible")void refresh();};
   document.addEventListener("visibilitychange",visible);
   return()=>{alive.current=false;serial.current++;clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[user.uid,user.groupId,user.gameId]);
 // Refresh immediately whenever the national controls accessible to players change.
 useEffect(()=>{if(alive.current&&view&&national.tour!==view.tour)void refresh();},[national.tour]);
 async function vote(tour,selection,favorite){
   if(!view||failure)throw Error("Connexion en cours. Réessaie.");
   await request("/game/vote",{gameId:view.gameId,tour,selection,...(tour===1?{favorite}:{})});
   await refresh();
 }
 if(!view)return <main className="tv-page"><p role="status">{failure||"Connexion à ton groupe…"}</p>{failure&&<button onClick={()=>void refresh()}>Réessayer</button>}<button onClick={leave}>Retour à l’accueil</button></main>;
 const context={...national,tour:view.tour,votesOpen:view.votesOpen&&!failure,adminSelections:view.adminSelections,gameId:view.gameId,players:{[user.pseudo]:view.ownVote},groupTrend:view.trend,updateFirstRoundWithFavorite:(_pseudo,selection,favorite)=>vote(1,selection,favorite),updatePlayerVote:(_pseudo,tour,selection)=>vote(tour,selection)};
 return <AppContext.Provider value={context}>
   {failure&&<p role="alert" style={{textAlign:"center",color:"#ffb3b3"}}>{failure} <button onClick={()=>void refresh()}>Réessayer</button></p>}
   {view.finaleStarted?<main className="tv-page tv-show-v3"><h2>Le show final arrive !</h2><p>Les résultats multigroupes ne sont pas encore raccordés sur cette version test.</p><button onClick={leave}>Retour à l’accueil</button></main>:waiting?<Waiting user={user}/>:<Player user={user} setUser={setUser}/>}
 </AppContext.Provider>;
}
