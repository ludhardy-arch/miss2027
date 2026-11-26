// Conditional writes against the dedicated test RTDB, no client-side cached snapshot.
export async function conditionalWrite({read,write,operation,verify,attempts=5}){
 for(let i=0;i<attempts;i++){
  const {state,etag}=await read();
  if(!etag)throw Error("database_etag_missing");
  const outcome=operation(state);
  if(outcome.code)return {status:409,body:{error:outcome.code,...(outcome.reasons?{reasons:outcome.reasons}:{})}};
  if(outcome.state===undefined)throw Error("database_state_missing");
  if(verify&&!verify(outcome.state))return {status:409,body:{error:"reset_not_verified"}};
  const committed=await write(outcome.state,etag);
  if(!committed.ok)continue;
  if(verify&&!verify(committed.state))return {status:409,body:{error:"reset_not_verified"}};
  return {status:200,body:outcome.result,state:committed.state};
 }
 return {status:409,body:{error:"conflict"}};
}
