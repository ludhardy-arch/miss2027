import test from "node:test";
import { createTrendPublisher } from "./trendPublisher.js";
function harness() {
  const pending = new Map(), writes = [], errors = [];
  let next = 0, reads = 0, count = 0, fail = false, hold = null;
  const publisher = createTrendPublisher({
    readSummary: async () => { reads++; const n = count; if (hold) await hold; return {tour:1,totalPlayers:1000,validatedVotes:n,counts:{1:n}}; },
    publishSummary: async summary => { if (fail) throw Error("offline"); writes.push(summary.validatedVotes); },
    setTimer: (fn, ms) => { if(ms!==2000) throw Error("wrong interval"); pending.set(++next, fn); return next; },
    clearTimer: id => pending.delete(id),
    onError: e => errors.push(e.message)
  });
  const fire = () => { const entry = pending.entries().next().value; if(!entry) throw Error("no timer"); pending.delete(entry[0]); return entry[1](); };
  return { publisher, pending, writes, errors, fire, setCount:n=>count=n, setFail:x=>fail=x, setHold:x=>hold=x, reads:()=>reads };
}
function equal(actual,expected){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`Expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);}
test("idle and 1000 notifications coalesce; identical state is not republished", async function(){
  const h=harness();equal(h.pending.size,0);equal(h.reads(),0);for(let i=1;i<=1000;i++){h.setCount(i);h.publisher.notify();}
  equal(h.pending.size,1);await h.fire();equal(h.writes,[1000]);equal(h.pending.size,0);
  h.publisher.notify();await h.fire();equal(h.writes,[1000]);equal(h.reads(),2);
});
test("changes during an outstanding read are not lost", async function(){
  const h=harness();let release;h.setHold(new Promise(r=>{release=r;}));h.setCount(18);h.publisher.notify();const work=h.fire();await Promise.resolve();h.setCount(45);h.publisher.notify();equal(h.pending.size,0);h.setHold(null);release();await work;equal(h.writes,[18]);equal(h.pending.size,1);await h.fire();equal(h.writes,[18,45]);
});
test("failure retries without suppressing a successful publication", async function(){
  const h=harness();h.setCount(45);h.setFail(true);h.publisher.notify();await h.fire();equal(h.errors,["offline"]);equal(h.writes,[]);equal(h.pending.size,1);h.setFail(false);await h.fire();equal(h.writes,[45]);equal(h.pending.size,0);
});
test("closure flushes immediately, including a missed notification, and seals the round", async function(){
  const h=harness();h.setCount(18);h.publisher.notify();await h.fire();h.setCount(45);h.publisher.notify();h.setCount(46);await h.publisher.flushFinal();equal(h.writes,[18,46]);equal(h.pending.size,0);equal(h.publisher.notify(),false);await h.publisher.flushFinal();equal(h.writes,[18,46]);
});
test("closure waits for an in-flight write and allows retry on failure", async function(){
  const h=harness();let release;h.setHold(new Promise(r=>{release=r;}));h.setCount(18);h.publisher.notify();const work=h.fire();await Promise.resolve();h.setCount(45);h.setHold(null);const final=h.publisher.flushFinal();release();await work;await final;equal(h.writes,[18,45]);equal(h.pending.size,0);
  const j=harness();j.setCount(99);j.setFail(true);let failed=false;try{await j.publisher.flushFinal();}catch{failed=true;}equal(failed,true);j.setFail(false);await j.publisher.flushFinal();equal(j.writes,[99]);
});
