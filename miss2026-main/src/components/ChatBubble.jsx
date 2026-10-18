 import React, { useState, useEffect, useRef } from "react";
import { database } from "../firebase";
import { ROOM_PATH } from "../room";
import { ref, push, onValue } from "firebase/database";

export default function ChatBubble({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);

  const messagesEndRef = useRef(null);

  // Stocke l’ancien dernier message pour détecter les vrais nouveaux
  const lastMessageRef = useRef(null);

  // Charger messages Firebase
  useEffect(() => {
    const chatRef = ref(database, `${ROOM_PATH}/chat`);

    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).sort((a, b) => a.date - b.date);
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
  }, [open, user.pseudo]);

  // Scroll auto
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Envoi message
  const sendMessage = async () => {
    const message = text.trim();
    if (!message || sending) return;
    if (message.length > 500) {
      setChatError("Message trop long (500 caractères maximum).");
      return;
    }
    setSending(true);
    setChatError("");
    try {
      await push(ref(database, `${ROOM_PATH}/chat`), {
        author: user.pseudo,
        text: message,
        date: Date.now(),
      });
      setText("");
    } catch (error) {
      setChatError("Message non envoyé : " + (error?.code || error?.message));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Bulle flottante */}
      <div
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
      </div>

      {/* Fenêtre popup */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            right: 20,
            width: 260,
            height: 330,
            background: "rgba(10,10,20,0.95)",
            borderRadius: 12,
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            zIndex: 2147483647,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slideUp 0.3s ease-out",
          }}
        >
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
            💬 Chat Miss2027
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {messages.map((m, i) => {
              const isMe = m.author === user.pseudo;
              const isAdmin = m.author.toLowerCase() === "admin";

              return (
                <div
                  key={i}
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
                  <b>{isAdmin ? "👑 ADMIN" : m.author}</b>
                  <br />
                  {m.text}
                </div>
              );
            })}
            <div ref={messagesEndRef}></div>
          </div>

          {chatError && <p role="alert" style={{ color: "#ffb3b3", padding: 8, margin: 0, fontSize: 12 }}>{chatError}</p>}
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
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Écrire…"
              style={{
                flex: 1,
                borderRadius: 6,
                padding: 6,
                border: "none",
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{
                marginLeft: 6,
                background: "#ff4da6",
                color: "white",
                border: "none",
                padding: "6px 10px",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              ➤
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
}
