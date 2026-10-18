// src/components/MalounetteAd.jsx

import React, { useEffect, useState } from "react";

const slogans = [
  "Malounette — l’alcool ne fait pas gagner… mais ça aide à patienter.",
  "Malounette — la bière qui te fait voter mieux… ou pas.",
];

export default function MalounetteAd() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slogans.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        marginTop: 40,
        display: "flex",
        justifyContent: "center",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 20,
          overflow: "hidden",
          border: "4px solid rgba(255, 215, 0, 0.8)",
          background: "#111",
          boxShadow:
            "0 0 15px rgba(255,215,0,0.35), 0 0 30px rgba(255,140,0,0.25)",
          animation: "malounetteFrameGlow 4s ease-in-out infinite",
        }}
      >
        {/* IMAGE ANIMÉE */}
        <div
          style={{
            width: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <img
            src="/images/malounette-label.jpg"
            alt="Malounette"
            style={{
              width: "100%",
              animation: "malounetteBreath 5s ease-in-out infinite",
            }}
          />

          {/* léger pulse du fond */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.4) 100%)",
              animation: "rainbowPulse 8s ease-in-out infinite",
            }}
          />
        </div>

        {/* TEXTE */}
        <div
          style={{
            padding: "18px 16px 26px",
            textAlign: "center",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: "bold",
              marginBottom: 10,
              color: "#ffd700",
              textShadow: "0 0 6px rgba(255,215,0,0.5)",
            }}
          >
            Pub officielle Miss 2026 🍺
          </div>

          <div
            style={{
              fontSize: 18,
              lineHeight: 1.35,
              fontStyle: "italic",
              animation: "fadeIn 0.5s ease",
              marginBottom: 14,
            }}
          >
            {slogans[index]}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            À consommer avec modération…  
            Vos votes beaucoup moins.
          </div>
        </div>

        {/* ANIMATIONS */}
        <style>
          {`
            @keyframes malounetteBreath {
              0% { transform: scale(1); }
              50% { transform: scale(1.02); }
              100% { transform: scale(1); }
            }

            @keyframes rainbowPulse {
              0% { opacity: 0.85; }
              50% { opacity: 1; }
              100% { opacity: 0.85; }
            }

            @keyframes malounetteFrameGlow {
              0% { box-shadow: 0 0 12px rgba(255,215,0,0.3); }
              50% { box-shadow: 0 0 24px rgba(255,215,0,0.9); }
              100% { box-shadow: 0 0 12px rgba(255,215,0,0.3); }
            }

            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      </div>
    </div>
  );
}
