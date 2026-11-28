 import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {emptyMarker,newest,countUnread,getReadMarker,saveReadMarker} from "../chatUnread.mjs";
import { database } from "../firebase";
import { ref, push, onValue, get } from "firebase/database";

// Messages historiques envoyés avant l'utilisation du nom ADMIN.
const isAdminMessage = (message) => {
  const author = String(message?.author || "").trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
  return author === "admin" || author === "hardy ludo" || author === "ludo hardy";
};

export default function ChatBubble({ user, demoMessages = null, onDemoSend = null, groupRequest = null, groupName = null, inline = false, roomId = null, onRead = null, onReportChange = null, externalOpen=null, hideBubble=false, onUnread=null, headerExtra=null }) {
  const [bubbleOpen, setOpen] = useState(false);
  const open=inline||(externalOpen===null?bubbleOpen:externalOpen);
  const [messages, setMessages] = useState([]);
  const inDemo = Array.isArray(demoMessages);
  const visibleMessages = inDemo ? demoMessages : messages;
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError,setSendError]=useState("");
  const sendingRef=useRef(false);
  const readVersion=useRef(0);
  const [unread, setUnread] = useState(0);
  useEffect(()=>{onUnread?.(unread);},[unread,onUnread]);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [voteReminder,setVoteReminder]=useState(null),[dismissedReminder,setDismissedReminder]=useState(null);
  const [reports,setReports]=useState([]),[reportBusy,setReportBusy]=useState(null),[reportNotice,setReportNotice]=useState("");
  const marker=useRef(roomId?getReadMarker(user.uid,roomId):null);
  const openRef=useRef(open);openRef.current=open;
  const onReadRef=useRef(onRead);onReadRef.current=onRead;
  const onReportChangeRef=useRef(onReportChange);onReportChangeRef.current=onReportChange;
  function markRead(rows){
    marker.current=newest(rows,marker.current||emptyMarker);
    if(roomId)saveReadMarker(user.uid,roomId,marker.current);
    onReadRef.current?.(marker.current);
    setUnread(0);
  }
  function applyChat(data){
    const next=data.messages||[];
    if(marker.current===null||openRef.current)markRead(next);
    else setUnread(countUnread(next,marker.current,user.uid));
    setVoteReminder(data.voteReminder||null);
    setMessages(next);setChatBlocked(data.blocked===true);setReports(data.reports||[]);setChatError("");
  }
  async function reportRoom(){
    if(reportBusy||!groupRequest)return;
    if(!window.confirm("Alerter la régie d’un comportement inadapté dans le chat ?"))return;
    setReportBusy("room");setReportNotice("");
    try{
      const result=await groupRequest({action:"report_room"});
      if(result.accepted!==true||result.verified!==true)throw Error("Enregistrement de l’alerte non confirmé. Réessaie.");
      readVersion.current++;
      setReportNotice(result.alreadyReported?"Cette salle a déjà été signalée.":"Alerte transmise à la régie.");
      try{applyChat(await groupRequest());}catch{}
      onReportChangeRef.current?.();
    }catch(e){setReportNotice("Alerte non confirmée : "+e.message);}finally{setReportBusy(null);}
  }
  async function clearRoomAlerts(){
    if(!inline||reportBusy||!reports.length)return;
    if(!window.confirm("Effacer l’alerte de "+groupName+" ? Les messages du chat et les sanctions seront conservés."))return;
    setReportBusy("clear");setReportNotice("");
    try{
      const result=await groupRequest({action:"clear_room_alerts"});
      if(result.accepted!==true||result.verified!==true||result.roomId!==roomId)throw Error("Effacement non confirmé.");
      readVersion.current++;
      setReports(old=>old.filter(r=>!result.clearedIds.includes(r.messageId)));
      onReportChangeRef.current?.(result.rooms);
      setReportNotice("Alerte effacée.");
      try{applyChat(await groupRequest());}catch{}
    }catch(e){setReportNotice("Effacement non confirmé : "+e.message);}finally{setReportBusy(null);}
  }

  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);

  // Stocke l’ancien dernier message pour détecter les vrais nouveaux
  const lastMessageRef = useRef(null);

  // Charger messages Firebase
  useEffect(() => {
    if (inDemo || groupRequest) return;
    const chatRef = ref(database, "rooms/miss2027/chat");

    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).filter(m => !m.targetUid || m.targetUid === user.uid).sort((a, b) => a.date - b.date);
      setMessages(list);

      const last = list[list.length - 1] || null;

      // Première lecture = aucun badge
      if (lastMessageRef.current === null) {
        lastMessageRef.current = last;
        return;
      }

      // Aucun nouveau message ?
      if (
        !last ||
        (lastMessageRef.current && last.date === lastMessageRef.current.date)
      ) {
        return;
      }

      // Si c'est un nouveau message ET que la bulle est fermée ET que ce n'est pas l'utilisateur
      if (!open && last.author !== user.pseudo) {
        setUnread((u) => u + 1);
      }

      lastMessageRef.current = last;
    }, (error) => {
      setChatError("Lecture du chat refusée : " + error.code);
    });

    return () => unsubscribe();
  }, [open, user.pseudo, inDemo, groupRequest]);

  // Restriction du chat mise à jour en temps réel.
  useEffect(() => {
    if (inDemo || groupRequest || !user?.pseudo) return;
    return onValue(ref(database, `rooms/miss2027/players/${user.pseudo}/chatBlocked`),
      snap => setChatBlocked(snap.val() === true),
      error => setChatError("Modération indisponible : " + (error?.code || error?.message))
    );
  }, [inDemo, user?.pseudo, groupRequest]);

  useEffect(() => {
    if (!groupRequest) return;
    let active=true,busy=false;
    // Keep the last successful view during reconnects and while opening the bubble.
    async function poll(){
      if(!active||busy||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const version=readVersion.current;
        const data=await groupRequest();
        if(!active||version!==readVersion.current)return;
        applyChat(data);
      }catch(e){if(active)setChatError(e.message);}
      finally{busy=false;}
    }
    void poll();const timer=setInterval(poll,open?8000:15000);
    window.addEventListener("online",poll);document.addEventListener("visibilitychange",poll);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("online",poll);document.removeEventListener("visibilitychange",poll);};
  },[groupRequest,open,user.uid]);
  useEffect(()=>{if(open&&groupRequest&&marker.current!==null)markRead(messages);},[open]);
  // Scroll auto
  useEffect(() => {
    if (open && messagesEndRef.current) {
      if(inline&&messagesScrollRef.current)messagesScrollRef.current.scrollTop=messagesScrollRef.current.scrollHeight;
      else messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, inline]);

  // Envoi message
  const sendMessage = async () => {
    const message = text.trim();
    if (!message || sendingRef.current) return;
    if (!inDemo && chatBlocked) { setChatError("Ton accès à l’écriture dans le chat est bloqué par l’administrateur."); return; }
    if (message.length > 500) {
      setChatError("Message trop long (500 caractères maximum).");
      return;
    }
    sendingRef.current=true;
    setSending(true);
    setSendError("");setChatError("");
    try {
      if (groupRequest) {
        const result=await groupRequest({text:message});
        if(result.accepted!==true)throw Error("Envoi non confirmé.");
        readVersion.current++;
        setText(current=>current===message||current.trim()===message?"":current);
        try{
          const data=await groupRequest();applyChat(data);
        }catch(e){setChatError("Message envoyé. Actualisation en attente.");}
        return;
      }
      if (inDemo && onDemoSend) { await onDemoSend(message);setText("");return; }
      if (inDemo) {setText("");return;}
      if (!inDemo) {
        const restriction = await get(ref(database, `rooms/miss2027/players/${user.pseudo}/chatBlocked`));
        if (restriction.val() === true) { setChatBlocked(true); throw new Error("Accès à l’écriture bloqué par l’administrateur."); }
      }
      await push(ref(database, "rooms/miss2027/chat"), {
        author: user.pseudo,
        text: message,
        date: Date.now(),
      });
      setText("");
    } catch (error) {
      setSendError("Envoi non confirmé : " + (error?.message || error?.code));
    } finally {
      sendingRef.current=false;setSending(false);
    }
  };

  const content=(
    <>
      {!inline&&!inDemo&&voteReminder&&voteReminder.id!==dismissedReminder&&<div role="alert" style={{position:"fixed",top:"max(85px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",width:"min(340px, calc(100vw - 24px))",boxSizing:"border-box",zIndex:2147483647,background:"#5c3f13",border:"2px solid #ffd778",borderRadius:12,padding:12,color:"#fff",boxShadow:"0 4px 20px #0008",display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1}}><b style={{color:"#ffe3aa"}}>Rappel de la régie</b><div>{voteReminder.text}</div></div>
        <button type="button" aria-label="Fermer le rappel" onClick={()=>setDismissedReminder(voteReminder.id)} style={{width:32,minWidth:32,minHeight:32,padding:0,margin:0,background:"#735021",color:"#fff",boxShadow:"none"}}>✕</button>
      </div>}
      {/* Bulle flottante */}
      {!inline&&!hideBubble&&<div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 55,
          height: 55,
          borderRadius: "50%",
          background: "#ff4da6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2147483647, // Toujours au-dessus
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          animation: unread > 0 ? "pulseBubble 1.5s infinite" : "none",
        }}
        onClick={() => {
          setOpen(!open);
          setUnread(0); // reset badge
        }}
      >
        💬
        {unread > 0 && !open && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "red",
              color: "white",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: "50%",
              fontWeight: "bold",
            }}
          >
            {unread}
          </span>
        )}
      </div>}

      {/* Fenêtre popup */}
      {open && (
        <div
          style={{
            position: inline?"relative":"fixed",
            bottom: inline?undefined:90,
            right: inline?undefined:20,
            width: inline?"100%":"min(340px, calc(100vw - 32px))",
            height: inline?320:headerExtra?"min(540px, 72dvh)":"min(400px, 55dvh)",
            marginTop:inline?12:0,
            border:inline?"1px solid #395783":undefined,
            background: "rgba(10,10,20,0.95)",
            borderRadius: 12,
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            zIndex: inline?undefined:2147483647,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          {headerExtra}
          {/* Header */}
          <div
            style={{
              padding: 10,
              background: "rgba(255,255,255,0.1)",
              textAlign: "center",
              color: "white",
              fontWeight: "bold",
            }}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <span style={{flex:1,minWidth:0,overflowWrap:"anywhere"}}>💬 {groupName || "Chat Miss2027"}{inDemo ? " · Démo" : ""}</span>
              {groupRequest&&!inDemo&&<button type="button" onClick={()=>void reportRoom()} disabled={!!reportBusy} title="Alerter la régie d’un comportement inadapté dans le chat" style={{width:"auto",minWidth:0,minHeight:30,flex:"0 0 auto",margin:0,padding:"5px 8px",fontSize:11,whiteSpace:"nowrap",borderRadius:6,background:"#9a273c",border:"1px solid #ff8793",color:"#fff",boxShadow:"none"}}>{reportBusy==="room"?"…":"⚠ Alerter"}</button>}
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesScrollRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {inline&&!visibleMessages.length&&!chatError&&<p style={{margin:"auto",color:"#abc1de",fontSize:13}}>Aucun message pour le moment.</p>}
            {visibleMessages.map((m, i) => {
              const isAdmin = groupRequest ? m.admin === true : isAdminMessage(m);
              const isMe = !isAdmin && (groupRequest ? m.uid === user.uid : m.author === user.pseudo);

              return (
                <div
                  key={m.id || i}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",

                    background: isMe
                      ? "#ff4da6"
                      : isAdmin
                      ? "rgba(255, 215, 0, 0.22)" // Fond doré léger
                      : "rgba(255,255,255,0.15)",

                    padding: "6px 10px",
                    borderRadius: 10,
                    maxWidth: "80%",

                    color: isAdmin ? "#ffd700" : "white", // Texte doré
                    fontWeight: isAdmin ? "bold" : "normal",
                    border: isAdmin ? "1px solid #ffd700" : "none",
                    boxShadow: isAdmin
                      ? "0 0 10px rgba(255,215,0,0.4)"
                      : "none",
                  }}
                >
                  <b>{isAdmin ? "✦ ADMIN ✦" : m.author}</b>
                  <br />
                  {m.text}
                </div>
              );
            })}
            <div ref={messagesEndRef}></div>
          </div>

          {reportNotice&&<p role="status" style={{color:"#ffd699",padding:6,margin:0,fontSize:12}}>{reportNotice}</p>}
          {sendError&&<p role="alert" style={{color:"#ffb3b3",padding:8,margin:0,fontSize:12}}>{sendError}</p>}
          {chatError && <p role="alert" style={{ color: "#ffb3b3", padding: 8, margin: 0, fontSize: 12 }}>{chatError}</p>}
          {chatBlocked && !inDemo && <p role="status" style={{color:"#ffd699",fontWeight:700,padding:"9px",margin:0,textAlign:"center"}}>🔇 Ton accès à l’écriture dans le chat a été bloqué par l’administrateur.</p>}
          {/* Input */}
          <div
            style={{
              display: "flex",
              padding: 8,
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();void sendMessage();}}}
              aria-label="Message à envoyer"
              placeholder={chatBlocked && !inDemo ? "Écriture bloquée" : "Écrire…"}
              disabled={chatBlocked && !inDemo}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                width: 0,
                fontSize: 16,
                borderRadius: 6,
                padding: 6,
                border: "none",
                outline: "none",
              }}
            />
            <button
              type="button"
              aria-label="Envoyer le message"
              onClick={sendMessage}
              disabled={sending || !text.trim() || (chatBlocked && !inDemo)}
              style={{
                marginLeft: 6,
                marginTop: 0,
                width: 44,
                minWidth: 44,
                minHeight: 44,
                flex: "0 0 44px",
                boxShadow: "none",
                background: "#ff4da6",
                color: "white",
                border: "none",
                padding: "6px 10px",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {sending?"…":"➤"}
            </button>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>
        {`
        @keyframes slideUp {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes pulseBubble {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}
      </style>
    </>
  );
  return inline?<>{reports.length>0&&<section style={{marginTop:12,border:"1px solid #ff8793",borderRadius:10,padding:10,background:"#42192a"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
      <strong style={{color:"#ffc0ca"}}>⚠ {reports.length} alerte{reports.length>1?"s":""} à traiter · {groupName}</strong>
      <button type="button" disabled={!!reportBusy} onClick={()=>void clearRoomAlerts()} style={{width:"auto",minWidth:0,background:"#176849",fontSize:12,minHeight:32,padding:"5px 9px",boxShadow:"none"}}>{reportBusy==="clear"?"Effacement…":"Effacer l’alerte"}</button>
    </div>
    {reports.map(r=><div key={r.messageId} style={{marginTop:8,padding:8,borderRadius:8,background:"#152849",overflowWrap:"anywhere"}}>
      <b>{r.roomReport?"Conversation signalée":r.author} · {r.count} signalement{r.count>1?"s":""}</b>
      {r.roomReport?<details style={{margin:"6px 0"}}><summary>Contexte au moment de l’alerte</summary>{(Array.isArray(r.context)?r.context:Object.values(r.context||{})).map((m,i)=><p key={i} style={{margin:"4px 0",whiteSpace:"pre-wrap",fontSize:12}}><b>{m.author} :</b> {m.text}</p>)}{!r.context&&<p>Aucun message public enregistré.</p>}</details>:<p style={{margin:"5px 0",whiteSpace:"pre-wrap"}}>{r.text}</p>}
    </div>)}
  </section>}{content}</>:createPortal(content,document.body);
}
