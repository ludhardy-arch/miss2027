import React, { useContext, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { calculatePoints } from "../services/points";
import { AppContext } from "../context/AppContext";

// Premium, mobile-first ceremony for the PLAYERS' prediction competition.
export default function FinalShow({ players, adminSelections, isAdmin }) {
  const { updateFinaleStarted } = useContext(AppContext);
  const ranking = useMemo(() => Object.entries(players || {})
    .map(([pseudo, votes]) => ({ pseudo, points: calculatePoints(votes, adminSelections) || 0 }))
    .sort((a, b) => b.points - a.points || a.pseudo.localeCompare(b.pseudo, "fr"))
    .map((player, index) => ({ ...player, rank: index + 1 })), [players, adminSelections]);

  const [scene, setScene] = useState("intro");
  const [introStep, setIntroStep] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [revealIndex, setRevealIndex] = useState(ranking.length - 1);
  const [nameVisible, setNameVisible] = useState(false);

  // Existing intro rhythm: 4 s, 4 s, countdown, then announcements.
  useEffect(() => {
    if (scene !== "intro") return;
    const timer = setTimeout(() => {
      if (introStep < 2) setIntroStep(value => value + 1);
      else if (countdown > 0) setCountdown(value => value - 1);
      else {
        setRevealIndex(ranking.length - 1);
        setScene(ranking.length > 1 ? "reveal" : "suspense");
      }
    }, introStep < 2 ? 4000 : countdown > 0 ? 1000 : 1800);
    return () => clearTimeout(timer);
  }, [scene, introStep, countdown, ranking.length]);

  // Everyone except the winner is revealed from last place to second place.
  useEffect(() => {
    if (scene !== "reveal") return;
    setNameVisible(false);
    const show = setTimeout(() => setNameVisible(true), 2200);
    const next = setTimeout(() => {
      if (revealIndex > 1) setRevealIndex(index => index - 1);
      else setScene("suspense");
    }, 5500);
    return () => { clearTimeout(show); clearTimeout(next); };
  }, [scene, revealIndex]);

  useEffect(() => {
    if (scene !== "suspense") return;
    const timer = setTimeout(() => setScene("winner"), 5800);
    return () => clearTimeout(timer);
  }, [scene]);

  useEffect(() => {
    if (scene !== "winner") return;
    const boom = setTimeout(() => {
      confetti({ particleCount: 170, spread: 95, origin: { y: 0.58 }, colors: ["#f9dfa3", "#c89142", "#ffffff", "#f6a2c4"] });
      confetti({ particleCount: 120, spread: 130, origin: { y: 0.74 }, colors: ["#eac77b", "#ffffff", "#b97928"] });
    }, 450);
    const next = setTimeout(() => setScene("podium"), 7500);
    return () => { clearTimeout(boom); clearTimeout(next); };
  }, [scene]);

  useEffect(() => {
    if (scene !== "podium") return;
    const next = setTimeout(() => setScene("results"), 7500);
    return () => clearTimeout(next);
  }, [scene]);

  const quit = async () => {
    if (window.confirm("Quitter le show ?")) {
      try { await updateFinaleStarted(false); }
      catch (error) { window.alert("Impossible de quitter le show : " + error.message); }
    }
  };

  const winner = ranking[0];
  const revealed = ranking[revealIndex];
  const ordinal = rank => rank === 1 ? "1re" : `${rank}e`;
  const baseCard = { width: "100%", maxWidth: 460, margin: "auto", position: "relative", zIndex: 1 };
  const smallCap = { fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e5c287", fontFamily: "Arial, sans-serif", fontWeight: 700 };
  const headline = { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, textShadow: "0 2px 30px rgba(205,144,60,.35)" };
  const gold = { color: "#ffe0a0" };

  return (
    <div className="finalshow" role="dialog" aria-modal="true" aria-label="Miss France 2027, cérémonie finale">
      <div className="finalshow-glow" aria-hidden="true" />
      <div className="finalshow-stage" aria-hidden="true"><div className="finalshow-stage-ring" /></div>
      <header className="finalshow-header">
        <div style={{ fontSize: 27, lineHeight: 1, color: "#f0cf86" }} aria-hidden="true">♛</div>
        <div style={{ ...smallCap, fontSize: 14, letterSpacing: ".14em" }}>MISS FRANCE <span style={gold}>2027</span></div>
        <div style={{ ...smallCap, fontSize: 9, color: "#d9bfa0", letterSpacing: ".2em" }}>Le jeu des pronostics</div>
        {isAdmin && <button className="finalshow-quit" onClick={quit}>Quitter</button>}
      </header>

      <div className="finalshow-main">
        <div key={`${scene}-${scene === "reveal" ? revealIndex : introStep}`} className="finalshow-enter" style={baseCard}>
          {scene === "intro" && (
            <div className="finalshow-center">
              <div style={smallCap}>La grande soirée</div>
              <h1 style={{ ...headline, fontSize: "clamp(31px,9vw,58px)", margin: "20px 0", lineHeight: 1.2 }}>Miss France<br /><span style={gold}>est élue…</span></h1>
              {introStep >= 1 && <p style={{ ...headline, fontSize: "clamp(23px,7vw,38px)", lineHeight: 1.35 }}>Mais pour nous,<br /><strong style={gold}>qui aura la couronne ?</strong></p>}
              {introStep >= 2 && <div className="finalshow-count">{countdown > 0 ? countdown : "RÉSULTATS OFFICIELS !"}</div>}
            </div>
          )}

          {scene === "reveal" && revealed && (
            <div className="finalshow-center">
              <div style={smallCap}>Le classement des joueurs</div>
              <div className="finalshow-ribbon">{ordinal(revealed.rank)} PLACE</div>
              <p style={{ ...headline, fontSize: "clamp(21px,6vw,30px)", margin: "18px 0 20px" }}>À la {ordinal(revealed.rank)} place…</p>
              <div className="finalshow-medallion" aria-hidden="true">♛</div>
              {nameVisible ? (
                <div className="finalshow-name-enter">
                  <h2 className="finalshow-name">{revealed.pseudo}</h2>
                  <div className="finalshow-points">{revealed.points} points</div>
                </div>
              ) : <p style={{ color: "#d3b788", letterSpacing: ".28em" }}>•••</p>}
            </div>
          )}

          {scene === "suspense" && (
            <div className="finalshow-center">
              <div style={smallCap}>Le moment tant attendu</div>
              <h1 style={{ ...headline, margin: "32px 0", fontSize: "clamp(31px,9vw,52px)", lineHeight: 1.2 }}>
                ET LE <span style={gold}>MEILLEUR</span><br />
                <span style={gold}>PRONOSTIQUEUR</span><br />
                DE MISS FRANCE <span style={gold}>2027</span><br />
                EST…
              </h1>
              <p className="finalshow-name-enter" style={{ ...headline, fontSize: "clamp(25px,7vw,40px)", color: "#f3e4ce", animationDelay: "1.8s" }}>ET RESTERA…</p>
              <div className="finalshow-shimmer" aria-hidden="true" />
            </div>
          )}

          {scene === "winner" && winner && (
            <div className="finalshow-center">
              <div style={smallCap}>Miss France 2027</div>
              <div className="finalshow-ribbon">GRAND GAGNANT</div>
              <div className="finalshow-medallion finalshow-medallion-winner" aria-hidden="true">♛</div>
              <h1 className="finalshow-winner">{winner.pseudo}</h1>
              <div className="finalshow-points">{winner.points} points</div>
              <p style={{ color: "#edd6ad", fontSize: 13, marginTop: 25 }}>Félicitations à notre champion !</p>
            </div>
          )}

          {scene === "podium" && (
            <div className="finalshow-center">
              <div style={smallCap}>La cérémonie des récompenses</div>
              <h2 style={{ ...headline, color: "#ffe1a0", fontSize: "clamp(30px,8vw,46px)", margin: "18px 0 35px" }}>LE PODIUM FINAL</h2>
              <div className="finalshow-podium">
                {[1, 0, 2].map((index) => {
                  const player = ranking[index];
                  if (!player) return <div key={index} style={{ flex: 1 }} />;
                  return <div key={player.pseudo} className="finalshow-podium-person">
                    <div className="finalshow-podium-name">{player.pseudo}</div>
                    <div className="finalshow-podium-points">{player.points} pts</div>
                    <div className={`finalshow-podium-column place-${index + 1}`}>{index + 1}</div>
                  </div>;
                })}
              </div>
              <p style={{ color: "#edcf97", marginTop: 25, fontSize: 13 }}>Bravo aux trois premiers !</p>
            </div>
          )}

          {scene === "results" && (
            <div className="finalshow-results">
              <div style={{ ...smallCap, textAlign: "center" }}>Miss France 2027</div>
              <h2 style={{ ...headline, textAlign: "center", color: "#ffe1a0", fontSize: "clamp(29px,8vw,42px)", margin: "14px 0 26px" }}>Classement final</h2>
              <div className="finalshow-ranking">
                {ranking.map(player => (
                  <div className="finalshow-ranking-row" key={player.pseudo}>
                    <span className={`finalshow-rank-number rank-${player.rank}`}>{player.rank}</span>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontWeight: player.rank === 1 ? 700 : 400 }}>{player.pseudo}</span>
                    <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{player.points} pts</span>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: "center", color: "#a8a09b", fontSize: 12, marginTop: 20 }}>Merci à tous d'avoir joué !</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .finalshow { position:fixed; inset:0; z-index:10000; display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; color:#fff6e9; background:radial-gradient(ellipse 90% 70% at 50% 77%, #55351d 0%, transparent 58%),linear-gradient(165deg,#080910 0%,#1c1218 49%,#07080d 100%); font-family:Arial,sans-serif; isolation:isolate; }
        .finalshow * { box-sizing:border-box; }
        .finalshow-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at 5% 15%,rgba(255,197,111,.24),transparent 32%),radial-gradient(ellipse at 94% 14%,rgba(255,189,109,.22),transparent 30%),repeating-linear-gradient(107deg,transparent 0%,transparent 23%,rgba(226,173,96,.035) 25%,transparent 28%); }
        .finalshow-stage { position:absolute; left:0; right:0; bottom:-115px; height:270px; opacity:.65; background:radial-gradient(ellipse at 50% 70%,rgba(242,185,96,.5),transparent 60%); pointer-events:none; }
        .finalshow-stage-ring { margin:100px auto 0; max-width:450px; height:75px; border:2px solid rgba(242,189,111,.38); border-radius:50%; box-shadow:0 0 32px 5px rgba(237,164,84,.14); }
        .finalshow-header { flex-shrink:0; text-align:center; position:relative; z-index:2; padding: max(18px,env(safe-area-inset-top)) 66px 12px; border-bottom:1px solid rgba(230,183,112,.19); }
        .finalshow-quit { position:absolute; top:max(16px,env(safe-area-inset-top)); right:12px; border:1px solid rgba(230,183,112,.5); color:#f4dec4; background:rgba(0,0,0,.4); border-radius:30px; padding:9px 11px; font-size:12px; cursor:pointer; }
        .finalshow-main { flex:1; display:flex; align-items:center; justify-content:center; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:20px 18px max(30px,env(safe-area-inset-bottom)); position:relative; z-index:2; }
        .finalshow-center { text-align:center; }
        .finalshow-enter { animation:finalShowEnter .8s both; }
        .finalshow-ribbon { margin:27px auto 0; background:linear-gradient(95deg,#ae7639,#ffe3a8 40%,#cf9551 80%,#9e692f); color:#261508; font:700 clamp(16px,5vw,23px) Georgia,serif; letter-spacing:.05em; padding:12px 16px; max-width:335px; box-shadow:0 4px 25px rgba(224,168,83,.2); transform:skewY(-2deg); }
        .finalshow-medallion { display:grid; place-items:center; font-size:65px; color:#ffe0a0; width:132px; height:132px; margin:18px auto; border:2px solid #d9a766; border-radius:50%; background:radial-gradient(circle,#51402c,#100f14 65%); box-shadow:0 0 0 8px rgba(202,146,65,.12),0 0 60px rgba(250,184,92,.3); }
        .finalshow-medallion-winner { width:158px; height:158px; font-size:80px; margin:34px auto 25px; animation:winnerPulse 3s ease-in-out infinite; }
        .finalshow-name, .finalshow-winner { font:500 clamp(37px,10vw,62px) Georgia,serif; overflow-wrap:anywhere; color:#ffe0a0; margin:22px 0 12px; text-shadow:0 0 35px rgba(252,203,112,.6); }
        .finalshow-winner { font-size:clamp(42px,11vw,70px); }
        .finalshow-name-enter { animation:finalShowEnter .9s both; }
        .finalshow-points { display:inline-block; border:1px solid #c49456; background:rgba(7,7,12,.75); border-radius:40px; padding:9px 22px; font-size:clamp(16px,4.8vw,21px); }
        .finalshow-count { font:700 clamp(51px,19vw,105px) Georgia,serif; color:#ffe0a0; margin-top:34px; text-shadow:0 0 45px rgba(251,192,94,.45); }
        .finalshow-shimmer { height:2px; width:180px; margin:60px auto 0; background:linear-gradient(to right,transparent,#ffe2ac,transparent); box-shadow:0 0 28px #edbf77; animation:winnerPulse 2s ease-in-out infinite; }
        .finalshow-podium { display:flex; align-items:flex-end; gap:7px; width:100%; min-height:230px; }
        .finalshow-podium-person { flex:1; min-width:0; text-align:center; }
        .finalshow-podium-name { font:500 clamp(13px,4vw,20px) Georgia,serif; color:#ffe0a0; overflow-wrap:anywhere; margin-bottom:6px; }
        .finalshow-podium-points { font-size:11px; margin-bottom:11px; color:#e9d3b4; }
        .finalshow-podium-column { display:grid; place-items:center; color:#fff0d4; font:700 36px Georgia,serif; border-radius:7px 7px 0 0; border:1px solid rgba(255,232,190,.5); border-bottom:0; box-shadow:inset 0 10px 22px rgba(255,255,255,.15),0 0 20px rgba(242,179,98,.13); }
        .finalshow-podium-column.place-1 { height:154px; background:linear-gradient(90deg,#956322,#edc778,#9b662c); color:#3c2612; }
        .finalshow-podium-column.place-2 { height:115px; background:linear-gradient(90deg,#606b78,#d6dce2,#7a838d); color:#29313b; }
        .finalshow-podium-column.place-3 { height:85px; background:linear-gradient(90deg,#754125,#db9a63,#805036); color:#3b2417; }
        .finalshow-results { width:100%; }
        .finalshow-ranking { max-height:min(61vh,570px); overflow-y:auto; scrollbar-color:#a58051 #18131b; }
        .finalshow-ranking-row { display:flex; align-items:center; gap:12px; padding:13px 11px; margin:5px 0; border:1px solid rgba(236,202,151,.21); background:rgba(10,9,15,.72); border-radius:9px; font-size:14px; }
        .finalshow-rank-number { width:30px; height:30px; flex-shrink:0; display:grid; place-items:center; border-radius:7px; background:#393640; color:#fff; font-weight:700; }
        .finalshow-rank-number.rank-1 { background:linear-gradient(130deg,#eac77c,#bd8a3b); color:#30200e; }
        .finalshow-rank-number.rank-2 { background:linear-gradient(130deg,#e2e6eb,#8f9baa); color:#24303c; }
        .finalshow-rank-number.rank-3 { background:linear-gradient(130deg,#dea174,#985c34); color:#2b190e; }
        @keyframes finalShowEnter { from { opacity:0; transform:translateY(18px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes winnerPulse { 0%,100% { box-shadow:0 0 0 8px rgba(202,146,65,.12),0 0 42px rgba(250,184,92,.26); } 50% { box-shadow:0 0 0 12px rgba(202,146,65,.2),0 0 80px rgba(250,184,92,.6); } }
        @media (max-height:650px) { .finalshow-main { align-items:safe center; } .finalshow-medallion { width:100px; height:100px; font-size:48px; } .finalshow-medallion-winner { margin:15px auto; } .finalshow-ribbon { margin-top:12px; } }
        @media (prefers-reduced-motion:reduce) { .finalshow-enter,.finalshow-medallion-winner,.finalshow-shimmer,.finalshow-name-enter { animation:none; } }
      `}</style>
    </div>
  );
}
