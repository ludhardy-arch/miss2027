import React, { useEffect, useRef, useState } from "react";
import { database } from "../firebase";
import { ref, onValue, push } from "firebase/database";

// Same shared Firebase chat room as the players, embedded in the control room.
// Messages historiques envoyés avant l'utilisation du nom ADMIN.
const isAdminMessage = (message) => {
  const author = String(message?.author || "").trim().toLocaleLowerCase("fr").replace(/\\s+/g, " ");
  return author === "admin" || author === "hardy ludo" || author === "ludo hardy";
};

export default function AdminLiveChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);
  useEffect(() => onValue(ref(database, "rooms/miss2027/chat"),
    snap => setMessages(Object.values(snap.val() || {}).sort((a,b)=>(a.date||0)-(b.date||0))),
    err => setError("Chat indisponible : " + (err?.code || err?.message))), []);
  useEffect(() => { bottom.current?.scrollIntoView({ block:"nearest" }); }, [messages]);
  const send = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true); setError("");
    try {
      await push(ref(database, "rooms/miss2027/chat"), {author:"admin", text:message.slice(0,500), date:Date.now()});
      setText("");
    } catch(e) { setError("Envoi impossible : " + (e?.code || e?.message)); }
    finally { setSending(false); }
  };
  return <section className="regie-panel regie-chat">
    <div className="regie-panel-heading"><h3>💬 CHAT EN DIRECT</h3><span className="regie-live">● LIVE</span></div>
    <div className="regie-chat-messages" role="log" aria-label="Messages du chat">
      {messages.length === 0 && <p className="regie-muted">Aucun message pour le moment.</p>}
      {messages.map((m,i)=><div className={"regie-chat-message "+(m.author==="admin" || m.author===user.pseudo?"regie-chat-me":"")} key={i}>
        <strong style={isAdminMessage(m) ? {color:"#ffd779",textShadow:"0 0 11px rgba(255,211,108,.4)"} : undefined}>{isAdminMessage(m) ? "✦ ADMIN ✦" : m.author}</strong>{m.targetUid && <small style={{color:"#ffdfa5"}}> · avertissement ciblé</small>}<span>{m.text}</span>
      </div>)}
      <div ref={bottom} />
    </div>
    {error && <p role="alert" className="regie-error">{error}</p>}
    <form className="regie-chat-form" onSubmit={send}>
      <input aria-label="Message du chat" placeholder="Écrire un message…" maxLength={500} value={text} onChange={e=>setText(e.target.value)} />
      <button type="submit" disabled={sending || !text.trim()}>➤</button>
    </form>
  </section>;
}
