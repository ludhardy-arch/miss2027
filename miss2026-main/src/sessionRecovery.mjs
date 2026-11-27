// Cache is a convenience, never authority for identity or committed votes.
export function restoredPlayer(uid,data,manualExit=false){
 if(!uid||manualExit||!data?.group?.entered||!data.group.id||!data.gameId)return null;
 return {role:"player",uid,pseudo:data.group.pseudo,groupId:data.group.id,groupName:data.group.name,gameId:String(data.gameId)};
}
export function draftKeys(gameId,tour,uid){
 return {draft:`miss2027_${gameId}_${tour===3?"ranking":"selection"}_tour${tour}_${uid}`,favorite:`miss2027_${gameId}_favorite_tour1_${uid}`};
}
export function readSaved(storage,key,fallback){
 for(const store of storage){
  try{const raw=store?.getItem(key);if(raw!==null&&raw!==undefined)return JSON.parse(raw);}catch{}
 }
 return fallback;
}
export function writeSaved(storage,key,value){
 let success=false;
 for(const store of storage){try{store?.setItem(key,JSON.stringify(value));if(store)success=true;}catch{}}
 return success;
}
export function sanitizeDraft(raw,tour,allowed){
 const eligible=new Set(allowed);
 if(tour!==3)return Array.isArray(raw)?[...new Set(raw.map(Number))].filter(id=>eligible.has(id)).slice(0,tour===1?12:5):[];
 const result={},used=new Set();
 if(raw&&typeof raw==="object"&&!Array.isArray(raw))for(const [id,rank] of Object.entries(raw)){
  if(eligible.has(Number(id))&&Number.isInteger(rank)&&rank>=1&&rank<=5&&!used.has(rank)){result[id]=rank;used.add(rank);}
 }
 return result;
}
