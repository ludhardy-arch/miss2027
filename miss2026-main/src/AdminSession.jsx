import React,{useEffect,useState} from "react";
import {useLocation,useNavigate} from "react-router-dom";
import {onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from "firebase/auth";
import {auth} from "./firebase";
import {authorizedAdmin,TEST_ORIGIN} from "./testPlayerSession.mjs";
import Admin from "./pages/Admin";
// A separate root for the dedicated Firebase app. Never mounts player Login.
export default function AdminSession(){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const navigate=useNavigate(),location=useLocation();
 useEffect(()=>{
  let active=true,seq=0;
  const stop=onAuthStateChanged(auth,async current=>{
   const n=++seq;
   if(!active)return;
   if(!current){setUser(null);setReady(true);return;}
   try{
    const token=await current.getIdTokenResult();
    if(!active||n!==seq||auth.currentUser?.uid!==current.uid)return;
    if(!authorizedAdmin(current,import.meta.env.VITE_ADMIN_UID,token.signInProvider)){
      setUser(null);setError("Ce compte Google n’est pas autorisé à accéder à la régie.");setReady(true);return;
    }
    setUser({role:"admin",uid:current.uid,pseudo:current.displayName||"Admin"});setError("");setReady(true);
   }catch(e){if(active&&n===seq){setUser(null);setError("Impossible de vérifier la session administrateur. Réessaie.");setReady(true);}}
  },()=>{if(active){setUser(null);setError("Authentification administrateur indisponible.");setReady(true);}});
  return()=>{active=false;seq++;stop();};
 },[retry]);
 useEffect(()=>{if(location.pathname!=="/admin")navigate("/admin",{replace:true});},[location.pathname,navigate]);
 async function connect(){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const credential=await signInWithPopup(auth,new GoogleAuthProvider());
   const token=await credential.user.getIdTokenResult();
   if(!authorizedAdmin(credential.user,import.meta.env.VITE_ADMIN_UID,token.signInProvider)){await signOut(auth);throw Error("Compte Google non autorisé.");}
  }catch(e){setError(e.message||"Connexion Google impossible.");}finally{setBusy(false);}
 }
 if(user&&ready)return <Admin user={user} setUser={setUser}/>;
 return <main className="tv-page tv-show-v3" style={{maxWidth:600,margin:"40px auto",textAlign:"center",padding:20}}>
  <h1>RÉGIE DU DIRECT</h1><p>Espace administrateur indépendant des joueurs.</p>
  {!ready?<p role="status">Vérification de ta session administrateur…</p>:<>
   {error&&<p role="alert" style={{color:"#ffb3b3"}}>{error}</p>}
   <button type="button" onClick={connect} disabled={busy}>{busy?"Connexion…":"Se connecter avec Google"}</button>
   {error&&<button type="button" onClick={()=>{setReady(false);setError("");setRetry(n=>n+1);}}>Réessayer la vérification</button>}
  </>}
  <p><a href={TEST_ORIGIN+"/#/login"} target="_blank" rel="noopener noreferrer" style={{color:"#c6d3ee"}}>Ouvrir le site des joueurs</a></p>
 </main>;
}
