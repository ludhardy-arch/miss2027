// Test-only shared read cache and bounded vote coalescer. Writes always use fresh CAS reads.
export function createReadCache(read,{ttl=1500,clock=Date.now}={}){
 let generation=0,current=null,pending=null;
 const counts={hits:0,misses:0,coalesced:0};
 return {
  invalidate(){generation++;current=null;pending=null;},
  async get({allowFetch=true}={}){
   const t=clock();
   if(current&&t<current.until){counts.hits++;return current.state;}
   if(pending){counts.coalesced++;return pending.promise;}
   if(!allowFetch)throw Object.assign(Error("chat_budget_pause"),{status:503});
   counts.misses++;
   const g=generation,job={};
   job.promise=Promise.resolve().then(read).then(state=>{
    if(g===generation){current={state,until:clock()+ttl};}
    return state;
   }).finally(()=>{if(pending===job)pending=null;});
   pending=job;return job.promise;
  },
  stats(){return {...counts};}
 };
}
export function createVoteQueue(change,{windowMs=100,maxBatch=64,maxPending=1600,maxChatPending=300,maxChatBatch=16,setTimer=(fn,ms)=>setTimeout(fn,ms)}={}){
 let votes=[],chat=[],timer=null,running=false;
 const counts={batches:0,submitted:0,accepted:0,rejected:0,peak:0,chatSubmitted:0,chatAccepted:0,chatRejected:0,chatPeak:0};
 const schedule=()=>{
  if(running||timer!==null||(!votes.length&&!chat.length))return;
  timer=setTimer(()=>{timer=null;return flush();},votes.length>=maxBatch?0:windowMs);
 };
 function settle(job,r){
  const k=job.lane==="chat"?(r.status===200?"chatAccepted":"chatRejected"):(r.status===200?"accepted":"rejected");
  counts[k]++;job.resolve(r);
 }
 async function flush(){
  if(running||(!votes.length&&!chat.length))return;
  running=true;
  const jobs=votes.splice(0,maxBatch);
  // Always reserve the full vote capacity; chat uses spare slots only.
  jobs.push(...chat.splice(0,Math.min(maxChatBatch,maxBatch-jobs.length)));
  counts.batches++;
  try{
   const out=await change(root=>{
    let state=root;
    const items=jobs.map(job=>{
     const r=job.operation(state);
     if(r.code)return {status:409,body:{error:r.code}};
     if(r.state===undefined)throw Error("mutation_state_missing");
     state=r.state;return {status:200,body:r.result};
    });
    return {state,result:{items}};
   });
   if(out.status===200){
    if(out.body.items.length!==jobs.length)throw Error("mutation_batch_mismatch");
    jobs.forEach((job,i)=>settle(job,out.body.items[i]));
   }else jobs.forEach(job=>settle(job,{status:out.status,body:out.body}));
  }catch(e){jobs.forEach(job=>{counts[job.lane==="chat"?"chatRejected":"rejected"]++;job.reject(e);});}
  finally{running=false;schedule();}
 }
 function enqueue(lane,operation){
  const q=lane==="chat"?chat:votes;
  if(q.length>=(lane==="chat"?maxChatPending:maxPending))return Promise.resolve({status:503,body:{error:lane==="chat"?"chat_queue_busy":"vote_queue_busy"}});
  if(lane==="chat"){counts.chatSubmitted++;counts.chatPeak=Math.max(counts.chatPeak,q.length+1);}
  else{counts.submitted++;counts.peak=Math.max(counts.peak,q.length+1);}
  return new Promise((resolve,reject)=>{q.push({lane,operation,resolve,reject});schedule();});
 }
 return {enqueue:operation=>enqueue("vote",operation),enqueueChat:operation=>enqueue("chat",operation),stats(){return {...counts,pending:votes.length,chatPending:chat.length,running};}};
}
