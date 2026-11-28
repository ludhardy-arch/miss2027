export function chatFrame(previous,next){
  if(!previous)return {type:"snapshot",view:next};
  const {messages:before=[],...oldMeta}=previous;
  const {messages:after=[],...meta}=next;
  if(JSON.stringify(previous)===JSON.stringify(next))return null;
  const first=after[0]?.id;
  const drop=first===undefined?before.length:before.findIndex(m=>m.id===first);
  const retained=drop>=0?before.slice(drop):[];
  if(drop>=0&&retained.length<=after.length&&retained.every((m,i)=>JSON.stringify(m)===JSON.stringify(after[i]))){
    return {type:"delta",drop,append:after.slice(retained.length),meta};
  }
  return {type:"snapshot",view:next};
}
export function applyChatFrame(previous,frame){
  if(frame.type==="snapshot"&&Array.isArray(frame.view?.messages))return frame.view;
  if(frame.type!=="delta"||!previous||!Number.isInteger(frame.drop)||frame.drop<0||frame.drop>previous.messages.length||!Array.isArray(frame.append)||!frame.meta)throw Error("invalid_chat_frame");
  return {...frame.meta,messages:[...previous.messages.slice(frame.drop),...frame.append]};
}
