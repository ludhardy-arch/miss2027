// Test-only shared read cache and bounded vote coalescer. Writes always use fresh CAS reads.
export function createReadCache(read,{ttl=1500,clock=Date.now}={}){
 let generation=0,current=null,pending=null;
 const counts={hits:0,misses:0,coalesced:0};
 return {
  invalidate(){generation++;current=null;pending=null;},
  async get(){
   const t=clock();
   if(current&&t<current.until){counts.hits++;return current.state;}
   if(pending){counts.coalesced++;return pending.promise;}
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
export function createVoteQueue(change,{windowMs=100,maxBatch=64,maxPending=1200}={}){
 let queue=[],timer=null,running=false;
 const counts={batches:0,submitted:0,accepted:0,rejected:0,peak:0};
 const schedule=()=>{
  if(running||timer||!queue.length)return;
  timer=setTimeout(()=>{timer=null;void flush();},queue.length>=maxBatch?0:windowMs);
 };
 async function flush(){
  if(running||!queue.length)return;
  running=true;
  const jobs=queue.splice(0,maxBatch);counts.batches++;
  try{
   const out=await change(root=>{
    let state=root;
    const items=jobs.map(job=>{
     const r=job.operation(state);
     if(r.code)return {status:409,body:{error:r.code}};
     if(r.state===undefined)throw Error("vote_state_missing");
     state=r.state;return {status:200,body:r.result};
    });
    return {state,result:{items}};
   });
   if(out.status===200){
    if(out.body.items.length!==jobs.length)throw Error("vote_batch_mismatch");
    jobs.forEach((job,i)=>{const r=out.body.items[i];counts[r.status===200?"accepted":"rejected"]++;job.resolve(r);});
   }else{counts.rejected+=jobs.length;jobs.forEach(job=>job.resolve({status:out.status,body:out.body}));}
  }catch(e){counts.rejected+=jobs.length;jobs.forEach(job=>job.reject(e));}
  finally{running=false;schedule();}
 }
 return {
  enqueue(operation){
   if(queue.length>=maxPending)return Promise.resolve({status:503,body:{error:"vote_queue_busy"}});
   counts.submitted++;
   return new Promise((resolve,reject)=>{queue.push({operation,resolve,reject});counts.peak=Math.max(counts.peak,queue.length);schedule();});
  },
  stats(){return {...counts,pending:queue.length,running};}
 };
}
