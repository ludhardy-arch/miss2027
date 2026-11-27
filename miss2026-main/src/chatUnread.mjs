// Read markers survive refresh and the lobby -> game transition; scoped by user and room.
export const emptyMarker={date:0,id:""};
export const markerOf=m=>({date:Number(m?.date)||0,id:String(m?.id||"")});
export const later=(a,b)=>a.date>b.date||(a.date===b.date&&a.id.localeCompare(b.id)>0);
export function newest(messages,prior=emptyMarker){
 return (messages||[]).reduce((last,m)=>later(markerOf(m),last)?markerOf(m):last,prior);
}
export function countUnread(messages,marker,uid){
 return (messages||[]).filter(m=>m.uid!==uid&&later(markerOf(m),marker)).length;
}
const key=(uid,room)=>"miss-chat-read-v2:"+encodeURIComponent(uid)+":"+encodeURIComponent(room);
export function getReadMarker(uid,room){
 try{const v=JSON.parse(localStorage.getItem(key(uid,room)));if(v&&Number.isFinite(v.date)&&typeof v.id==="string")return v;}catch{}
 return null;
}
export function saveReadMarker(uid,room,marker){
 try{const previous=getReadMarker(uid,room);if(!previous||later(marker,previous))localStorage.setItem(key(uid,room),JSON.stringify(marker));}catch{}
}
