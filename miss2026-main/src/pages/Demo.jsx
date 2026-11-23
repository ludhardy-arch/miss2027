import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CANDIDATES } from "../data/candidates";
import { calculatePoints } from "../services/points";
import ChatBubble from "../components/ChatBubble";
import SelectionBubble from "../components/SelectionBubble";
import Leaderboard from "../components/Leaderboard";
import "./Demo.css";

// Fictional results, chosen for a demonstration, never read from / written to Firebase.
const QUALIFIED = [1, 3, 5, 7, 9, 11, 13, 15, 18, 21, 25, 29];
const FINALISTS = [3, 5, 9, 15, 25];
const OFFICIAL = [5, 25, 9, 3, 15];
const admin = { tour1: QUALIFIED, tour2: FINALISTS, tour3: OFFICIAL };
const contestant = id => CANDIDATES.find(m => m.id === id);
const label = id => contestant(id)?.label ?? String(id);
const pick = (arr, n) => arr.slice(0, n);
const DEMO_PLAYERS = [
  { pseudo: "Camille", favorite: 5, tour1: pick(QUALIFIED, 9).concat([2, 4, 6]), tour2: [3, 5, 9, 15, 25], tour3: [5, 25, 3, 9, 15] },
  { pseudo: "Alex", favorite: 3, tour1: pick(QUALIFIED.slice(2), 7).concat([2, 4, 6, 8, 10]), tour2: [3, 5, 9, 15, 25], tour3: [25, 5, 9, 15, 3] },
  { pseudo: "Sophie", favorite: 5, tour1: pick(QUALIFIED.slice(1), 8).concat([2, 4, 6, 8]), tour2: [3, 5, 9, 15, 25], tour3: [5, 9, 25, 3, 15] },
  { pseudo: "Maxime", favorite: 7, tour1: pick(QUALIFIED, 6).concat([2, 4, 6, 8, 10, 12]), tour2: [3, 5, 9, 15, 25], tour3: [9, 5, 3, 25, 15] },
  { pseudo: "Julie", favorite: 15, tour1: pick(QUALIFIED.slice(3), 7).concat([2, 4, 6, 8, 10]), tour2: [3, 5, 9, 15, 25], tour3: [5, 25, 9, 3, 15] },
  { pseudo: "Thomas", favorite: 5, tour1: pick(QUALIFIED, 8).concat([2, 4, 6, 8]), tour2: [3, 5, 9, 15, 25], tour3: [3, 9, 5, 15, 25] },
];
export default function Demo() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(1);
  const [selected1, setSelected1] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [selected2, setSelected2] = useState([]);
  const [ranking, setRanking] = useState([null, null, null, null, null]);
  const [scene, setScene] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([{ author: "Camille", text: "Bienvenue dans la démo ! 👑" }, { author: "Sophie", text: "À vous de choisir vos Miss !" }]);
  const cards = phase === 1 ? [...CANDIDATES].sort((a, b) => a.label.localeCompare(b.label, "fr")) : phase === 2 ? QUALIFIED.map(contestant).filter(Boolean) : FINALISTS.map(contestant).filter(Boolean);
  const selected = phase === 1 ? selected1 : selected2;
  const maximum = phase === 1 ? 12 : 5;
  const toggle = (id) => {
    const update = phase === 1 ? setSelected1 : setSelected2;
    if (phase === 1 && selected1.includes(id) && favorite === id) setFavorite(null);
    update(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < maximum ? [...prev, id] : prev);
  };
  const chooseFavorite = (event, id) => {
    event.stopPropagation();
    if (phase !== 1 || !selected1.includes(id)) return;
    setFavorite(current => current === id ? null : id);
  };
  const next = () => {
    if (phase === 1 && (selected1.length !== 12 || !selected1.includes(favorite))) return;
    if (phase === 2 && selected2.length !== 5) return;
    if (phase === 3 && ranking.filter(Boolean).length !== 5) return;
    setPhase(p => Math.min(p + 1, 4));
  };
  const self = { pseudo: "Vous", favorite, tour1: selected1, tour2: selected2, tour3: ranking };
  const demoPlayerRecords = useMemo(() => Object.fromEntries([self, ...DEMO_PLAYERS].map(p => [p.pseudo, { tour1: phase > 1 ? p.tour1 : [], tour2: phase > 2 ? p.tour2 : [], tour3: phase > 3 ? p.tour3 : [] }])), [selected1, selected2, ranking, phase]);
  const leaderboard = useMemo(() => [self, ...DEMO_PLAYERS]
    .map(p => ({ pseudo: p.pseudo, score: calculatePoints(p, admin) }))
    .sort((a,b) => b.score-a.score || a.pseudo.localeCompare(b.pseudo,"fr")), [selected1, selected2, ranking, favorite]);
  const restart = () => { setPhase(1); setSelected1([]); setFavorite(null); setSelected2([]); setRanking([null, null, null, null, null]); setScene(0); setShowScores(false); setSelectionOpen(false); setChatOpen(false); };
  const isGreen = id => selected1.includes(id) && QUALIFIED.includes(id);
  const isYellow = id => selected2.includes(id) && FINALISTS.includes(id) && !isGreen(id);
  const favoriteMiss = favorite !== null && selected1.includes(favorite) ? label(favorite) : null;
  return <main className="demo-page tv-show-v3">
    <header className="demo-head">
      <div className="demo-eyebrow">✦ MISS FRANCE 2027 ✦</div>
      <h1>MODE DÉCOUVERTE</h1>
      <p>Découvrez les 31 candidates de Miss France 2027 et testez vos pronostics.</p>
      <div className="demo-topactions"><button type="button" onClick={() => navigate("/login")}>← Retour à l'accueil</button></div>

    </header>
    {phase < 4 ? <>
      <section className="demo-intro">
        <div className="demo-eyebrow">TOUR {phase} · DÉMONSTRATION</div>
        <h2>{phase === 1 ? "Choisissez vos 12 Miss" : phase === 2 ? "Qui sera dans le top 5 ?" : "Classez les cinq finalistes"}</h2>
        <p>{phase === 1 ? "Sélectionnez 12 candidates, puis touchez le petit cœur en haut à droite de votre favorite. Si elle devient Miss France, vous gagnez 20 points bonus !" : phase === 2 ? "Parmi les 12 Miss qualifiées, choisissez vos 5 favorites pour la finale." : "Les 5 finalistes sont dévoilées ! À vous de prédire leur classement final."}</p>
        {phase === 1 && <p className="demo-favorite-note" aria-live="polite">{favoriteMiss ? `❤️ Votre coup de cœur : ${favoriteMiss}` : "♡ Choisissez un seul coup de cœur parmi vos 12 Miss."}</p>}
        {phase === 2 && <p className="demo-round-legend"><span className="demo-legend-swatch" style={{borderColor:"#12e994"}} /> Vous aviez déjà sélectionné cette Miss au premier tour.</p>}
        {phase === 3 && <div className="demo-round-legends">
          <p className="demo-round-legend"><span className="demo-legend-swatch" style={{borderColor:"#12e994"}} /> Vous avez sélectionné cette Miss aux deux premiers tours.</p>
          <p className="demo-round-legend"><span className="demo-legend-swatch" style={{borderColor:"#ffcf34"}} /> Vous avez sélectionné cette Miss uniquement au deuxième tour.</p>
        </div>}
        <div className="demo-counter">{phase === 3 ? ranking.filter(Boolean).length : selected.length} / {maximum} {phase === 3 ? "places attribuées" : "sélectionnées"}</div>
      </section>
      {phase === 2 && <div className="demo-reveal">✦ RÉSULTATS FICTIFS DU 1er TOUR ✦<p>{selected1.filter(id=>QUALIFIED.includes(id)).length} bonne(s) réponse(s) sur 12 — {selected1.filter(id=>QUALIFIED.includes(id)).length*15} points.</p></div>}
      {phase === 3 && <div className="demo-reveal">✦ RÉSULTATS FICTIFS DU 2e TOUR ✦<p>{selected2.filter(id=>FINALISTS.includes(id)).length} finalistes trouvé(e)s. Classez maintenant les cinq candidates.</p></div>}
      <div className="demo-grid">{cards.map(c => <div key={c.id} className={"demo-card "+(phase===1||phase===2 ? selected.includes(c.id)?"chosen":phase===2&&isGreen(c.id)?"green":"":ranking.includes(c.id)?"ranked":isGreen(c.id)?"green":isYellow(c.id)?"yellow":"")} onClick={()=>phase<3&&toggle(c.id)} role={phase<3?"button":undefined} tabIndex={phase<3?0:undefined} onKeyDown={e=>{if(phase<3&&(e.key==="Enter"||e.key===" ")){e.preventDefault();toggle(c.id)}}}>
          <div className="demo-portrait">
            <img src={c.image} alt={c.label} loading="lazy"/>
            {phase === 1 && <button
              type="button"
              className={`demo-heart ${favorite === c.id ? "active" : ""}`}
              disabled={!selected1.includes(c.id)}
              onClick={event => chooseFavorite(event, c.id)}
              onKeyDown={event => event.stopPropagation()}
              aria-pressed={favorite === c.id}
              aria-label={favorite === c.id ? `Retirer le coup de cœur de ${c.label}` : `Choisir ${c.label} comme coup de cœur`}
              title={selected1.includes(c.id) ? "Mon coup de cœur" : "Sélectionnez d’abord cette Miss"}
            >{favorite === c.id ? "♥" : "♡"}</button>}
            {phase > 1 && favorite === c.id && <span className="demo-heart demo-heart-reminder" title="Votre coup de cœur du premier tour" aria-label="Votre coup de cœur du premier tour">♥</span>}
          </div>
          <div className="demo-card-name">{c.label}</div>
          {phase===3 && <div className="demo-ranks"><label htmlFor={"rank-"+c.id}>Position</label><select id={"rank-"+c.id} value={ranking.indexOf(c.id)>=0?String(ranking.indexOf(c.id)+1):""} onChange={e=>{
            const pos=Number(e.target.value);setRanking(prev=>{const arr=prev.map(x=>x===c.id?null:x);if(pos && !arr[pos-1])arr[pos-1]=c.id;return arr;});
          }}><option value="">Choisir</option>{[1,2,3,4,5].filter(n=>!ranking[n-1] || ranking[n-1]===c.id).map(n=><option key={n} value={n}>{n===1?"Miss France":(n-1)+"e dauphine"}</option>)}</select></div>}
          
        </div>)}</div>
      <div className="tv-submit" style={{ textAlign: "center", marginTop: 20 }}><button type="button" disabled={phase===3?ranking.filter(Boolean).length!==5:selected.length!==maximum || (phase===1 && !selected1.includes(favorite))} onClick={next}>{phase===3?"Valider mon classement":"Valider mon vote"}</button></div>
      <Leaderboard demoPlayers={demoPlayerRecords} demoSelections={admin} />
      <SelectionBubble user={{pseudo:"Vous"}} tour={phase} selection={selected} />
    </> : <section className="demo-ceremony">
      <div className="demo-eyebrow">✦ LA GRANDE FINALE · SIMULATION ✦</div>
      {scene===0?<><div className="demo-crown">♛</div><h2>MISS FRANCE EST ÉLUE...</h2><p>Mais qui aura fait les meilleurs pronostics ?</p><button onClick={()=>setScene(1)}>Révéler le couronnement →</button></>:scene===1?<><div className="demo-crown">👑</div><h2>MISS {label(OFFICIAL[0]).toUpperCase()}</h2><p>Miss France 2027 — résultat fictif de la démonstration</p><div className="demo-podium">{OFFICIAL.map((id,i)=><div key={id}><strong>{i+1}</strong><span>{label(id)}</span></div>)}</div><button onClick={()=>{setScene(2);setShowScores(true)}}>Découvrir le classement des joueurs →</button></>:<><div className="demo-crown">🏆</div><h2>LE CLASSEMENT FINAL</h2><p>Voici les résultats complets de cette simulation.</p><div className="demo-scores">{leaderboard.map((p,i)=><div key={p.pseudo} className={p.pseudo==="Vous"?"me":""}><span>{i===0?"👑":i+1} · {p.pseudo}</span><strong>{showScores?p.score+" pts":"•••"}</strong></div>)}</div><button onClick={restart}>Rejouer la démo ↻</button></>}
      <p className="demo-note">Démo entièrement fictive · résultats non enregistrés · barème identique au concours</p>
    </section>}
    <ChatBubble user={{pseudo:"Vous"}} demoMessages={chatMessages} onDemoSend={text=>setChatMessages(prev=>[...prev,{author:"Vous",text}])} />
  </main>;
}
