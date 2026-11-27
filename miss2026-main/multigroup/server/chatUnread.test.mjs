import test from "node:test";import assert from "node:assert/strict";
import {emptyMarker,newest,countUnread,saveReadMarker,getReadMarker} from "../../src/chatUnread.mjs";
test("empty room first message and multiple arrivals are counted, own messages excluded",()=>{
 const rows=[{id:"a",date:1,uid:"other"},{id:"b",date:1,uid:"me"},{id:"c",date:1,uid:"other"}];
 assert.equal(countUnread(rows,emptyMarker,"me"),2);assert.equal(countUnread(rows,newest(rows),"me"),0);
 assert.equal(countUnread(rows,{date:1,id:"a"},"me"),1);
});
test("read markers persist and are isolated by player and room",()=>{
 const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 saveReadMarker("jen","a",emptyMarker);assert.deepEqual(getReadMarker("jen","a"),emptyMarker);
 saveReadMarker("jen","a",{date:2,id:"x"});saveReadMarker("jen","a",{date:1,id:"x"});
 assert.deepEqual(getReadMarker("jen","a"),{date:2,id:"x"});assert.equal(getReadMarker("rod","a"),null);assert.equal(getReadMarker("jen","b"),null);
 delete globalThis.localStorage;
});