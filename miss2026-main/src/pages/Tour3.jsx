import React, { useState } from "react";

export default function Tour3() {
  const [ranking, setRanking] = useState([1,2,3,4,5]);

  const changeRank = (index) => {
    const newRank = prompt(`Classez Miss ${index+1} à quelle place (1-5) ?`);
    const n = parseInt(newRank);
    if(n >= 1 && n <=5) {
      const newRanking = [...ranking];
      newRanking[index] = n;
      setRanking(newRanking);
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Tour 3 - Classement final</h1>
      <div style={{ display: "flex", gap: 10 }}>
        {ranking.map((place, i) => (
          <div 
            key={i} 
            onClick={() => changeRank(i)}
            style={{
              width: 100,
              height: 100,
              border: "3px solid gray",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer"
            }}
          >
            Miss {i+1} : place {place}
          </div>
        ))}
      </div>
      <button onClick={() => alert("Classement validé ! Page d'attente finale")}>
        Valider le classement
      </button>
    </div>
  );
}
