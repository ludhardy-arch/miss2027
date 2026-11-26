// Test branch only. Report dependency vulnerabilities without changing packages.
import {spawnSync} from "node:child_process";
for(const args of [["audit","--omit=dev","--json"],["audit","--json"]]){
 const r=spawnSync("npm",args,{encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024,shell:process.platform==="win32"});
 try{
  const j=JSON.parse(r.stdout||"{}");
  if(!j.metadata?.vulnerabilities||j.error)throw Error("unavailable");
  console.log("MISS2027_AUDIT "+JSON.stringify({scope:args.includes("--omit=dev")?"runtime":"all",totals:j.metadata.vulnerabilities,packages:Object.entries(j.vulnerabilities||{}).map(([name,v])=>({name,severity:v.severity,direct:v.isDirect,fix:v.fixAvailable,advisories:(v.via||[]).filter(x=>typeof x==="object").map(x=>({title:x.title,url:x.url,range:x.range}))}))}));
 }catch{console.warn("MISS2027_AUDIT_UNAVAILABLE "+(args.includes("--omit=dev")?"runtime":"all"));}
}
