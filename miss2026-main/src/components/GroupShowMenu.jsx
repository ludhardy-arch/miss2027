import React from "react";
export default function GroupShowMenu({groups,showKeyPrefix,onSelect}){
 function viewed(id){try{return sessionStorage.getItem(showKeyPrefix+id)==="done";}catch{return false;}}
 return <main className="group-show-menu">
  <style>{`
   .group-show-menu{box-sizing:border-box;max-width:600px;margin:20px auto;padding:24px 16px 35px;text-align:center;border:2px solid #d8b474;border-radius:24px;color:#fff3dc;background:radial-gradient(ellipse at 50% 8%,#34538d 0,transparent 48%),linear-gradient(155deg,#101b42,#070b20);box-shadow:0 0 25px #d8b47426;position:relative;overflow:hidden}
   .group-show-menu .group-show-heading{font-family:Georgia,serif;color:#ffe5a6;font-size:clamp(29px,8vw,45px);line-height:1.15;margin:14px 0 18px;text-shadow:0 0 24px #ffd78366}
   .group-show-menu .group-show-card{margin:16px auto;padding:18px 12px;border:1px solid #bd9958;border-radius:16px;background:linear-gradient(145deg,#182a55,#101c3a);box-shadow:inset 0 0 20px #b78b3722}
   .group-show-menu .group-show-card h2{color:#ffe5a6;font:700 clamp(20px,5vw,26px) Georgia,serif;overflow-wrap:anywhere;margin:4px 0 16px}
   .group-show-menu button.group-show-gold{width:100%;box-sizing:border-box;padding:14px 8px;min-height:52px;background:linear-gradient(160deg,#fff2bf,#e2b45b 48%,#be8737 50%,#f5d491)!important;color:#37230d!important;border:1px solid #fff1bd!important;border-radius:12px;font-size:15px;font-weight:900;box-shadow:0 0 15px #e6b64d55!important}
   .group-show-menu button.group-show-seen{background:linear-gradient(110deg,#15366e,#245397)!important;color:#fff!important;border-color:#7caee3!important;box-shadow:none!important}
  `}</style>
  <img src="/images/couronne-prestige.svg" alt="" style={{width:148,height:100,objectFit:"contain",filter:"drop-shadow(0 0 15px #ffd78366)"}}/>
  <div style={{fontSize:12,letterSpacing:".22em",color:"#f2d59c"}}>MISS FRANCE 2027</div>
  <h1 className="group-show-heading">LE SHOW FINAL</h1>
  <div aria-hidden="true" style={{height:1,background:"linear-gradient(90deg,transparent,#e5c17d,transparent)",margin:"0 14px 18px"}}/>
  <p style={{fontFamily:"Georgia,serif",fontStyle:"italic",color:"#f7e4c2"}}>Le moment que tu attendais est arrivé…</p>
  {groups.map(g=><section key={g.id} className="group-show-card"><h2>✦ {g.name} ✦</h2><button type="button" className={"group-show-gold"+(viewed(g.id)?" group-show-seen":"")} onClick={()=>onSelect(g.id)}>{viewed(g.id)?"Revoir le show":"▶ DÉCOUVRE TON RÉSULTAT"}</button></section>)}
 </main>;
}
