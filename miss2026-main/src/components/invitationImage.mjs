// Local-only card rendering. Never upload group credentials or the private link.
export function invitationMessage(name,link){
 return "Invitation à la soirée Miss France 2027 👑\nRejoins le groupe "+name+" !\n"+link;
}
export function invitationText(name,password,link){
 return ["Invitation à la soirée Miss France 2027","Samedi 12 décembre à 21 h","Ouverture de la salle à 20 h 40","Groupe : "+name,"Mot de passe : "+password,"Rejoins-nous : "+link].join("\n");
}
export function wrapText(value,measure,maxWidth){
 const rows=[];let line="";
 for(const char of String(value)){
  if(line&&measure(line+char)>maxWidth){rows.push(line);line="";}
  line+=char;
 }
 if(line||!rows.length)rows.push(line);
 return rows;
}
function rounded(ctx,x,y,w,h,r){
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function fillBox(ctx,x,y,w,h,r,fill,stroke,width=1){
 rounded(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function label(ctx,value,x,y,size,color,weight=400){
 ctx.font=weight+" "+size+"px Arial, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=color;ctx.fillText(value,x,y);
}
async function crown(){
 return new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error("Couronne indisponible"));img.src="/images/couronne-prestige.svg";
 });
}
export async function createInvitationImage({name,password}){
 const image=await crown();
 const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1360;
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("Image indisponible");
 const W=1080,H=1360,C=540;
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#10234c");bg.addColorStop(1,"#0a1533");
 fillBox(ctx,0,0,W,H,35,bg);
 const halo=ctx.createRadialGradient(C,170,10,C,170,470);halo.addColorStop(0,"rgba(55,104,220,.48)");halo.addColorStop(1,"rgba(55,104,220,0)");ctx.fillStyle=halo;ctx.fillRect(12,12,W-24,610);
 fillBox(ctx,5,5,W-10,H-10,30,"rgba(0,0,0,0)","#548ee0",9);
 const iw=350,ih=iw*image.naturalHeight/image.naturalWidth;
 ctx.save();ctx.shadowColor="rgba(255,216,145,.35)";ctx.shadowBlur=22;ctx.drawImage(image,C-iw/2,46,iw,ih);ctx.restore();
 label(ctx,"INVITATION À LA SOIRÉE",C,320,40,"#e0c58c",600);
 label(ctx,"MISS FRANCE 2027",C,400,74,"#ffe1a0",800);
 label(ctx,"Samedi 12 décembre à 21 h",C,505,44,"#ffffff",600);
 label(ctx,"Ouverture de la salle à 20 h 40",C,566,35,"#a8c9ff");
 const gold=ctx.createLinearGradient(110,0,970,0);gold.addColorStop(0,"#0a1533");gold.addColorStop(.5,"#ebc983");gold.addColorStop(1,"#0a1533");
 ctx.strokeStyle=gold;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(105,640);ctx.lineTo(520,640);ctx.moveTo(560,640);ctx.lineTo(975,640);ctx.stroke();
 ctx.fillStyle="#ebc983";ctx.beginPath();ctx.moveTo(C,627);ctx.lineTo(C+13,640);ctx.lineTo(C,653);ctx.lineTo(C-13,640);ctx.closePath();ctx.fill();
 fillBox(ctx,88,690,904,390,28,"#152c58","#577fb9",3);
 label(ctx,"NOM DU GROUPE",C,732,29,"#b6d0ff",600);
 let size=64,rows;
 do{ctx.font="800 "+size+"px Arial, sans-serif";rows=wrapText(name,t=>ctx.measureText(t).width,820);if(rows.length<=2)break;size-=2;}while(size>=22);
 rows.forEach((row,i)=>label(ctx,row,C,825+(i-(rows.length-1)/2)*size*1.1,size,"#ffdfa0",800));
 ctx.strokeStyle="#344f7c";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(125,914);ctx.lineTo(955,914);ctx.stroke();
 label(ctx,"Mot de passe du groupe :",C,949,32,"#ffffff");
 let ps=38,pr;
 do{ctx.font="700 "+ps+"px Arial, sans-serif";pr=wrapText(password,t=>ctx.measureText(t).width,820);if(pr.length<=3)break;ps-=2;}while(ps>=14);
 pr.forEach((row,i)=>label(ctx,row,C,1017+(i-(pr.length-1)/2)*ps*1.1,ps,"#ffffff",700));
 const green=ctx.createLinearGradient(88,0,992,0);green.addColorStop(0,"#003b26");green.addColorStop(.5,"#006f42");green.addColorStop(1,"#009e63");
 ctx.save();ctx.shadowColor="#15ef98";ctx.shadowBlur=22;fillBox(ctx,88,1132,904,110,28,green,"#15ef98",5);ctx.restore();
 label(ctx,"JE REJOINS MES AMIS",C,1187,43,"#ffffff",800);
 label(ctx,"Choisis ton pseudo et c’est parti !",C,1280,32,"#c4d9f5");
 label(ctx,"Ouvre le lien joint au message.",C,1322,25,"#a8c9ff");
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Image non créée")),"image/png"));
 return new File([blob],"Invitation-Miss-France-2027.png",{type:"image/png"});
}

// Only the existing bearer token goes in the URL; the API generates group-specific metadata.
export function richInvitationLink(original){
 const link=new URL(original);
 const match=/^#\/login\?invite=([a-f0-9]{64})$/.exec(link.hash);
 if(!match||!["https:","http:"].includes(link.protocol))throw Error("Lien d’invitation invalide");
 if(link.origin==="https://miss2027-test.onrender.com")return "https://miss2027-test-api.onrender.com/invitation/v3/"+match[1];
 return new URL("/invitation.html?invite="+match[1],link.origin).href;
}
