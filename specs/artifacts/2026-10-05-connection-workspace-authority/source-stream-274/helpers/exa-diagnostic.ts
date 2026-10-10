import fs from "node:fs";
const query="site:developer.mozilla.org OR site:html.spec.whatwg.org details summary keyboard interaction Enter Space";
const start=new Date().toISOString();
const response=await fetch("https://mcp.exa.ai/mcp",{method:"POST",headers:{accept:"application/json, text/event-stream","content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"web_search_exa",arguments:{query,numResults:5}}}),signal:AbortSignal.timeout(25000)});
const body=await response.text();
fs.writeFileSync("D:/myhexin-local/opencorvus/.tmp-product-iteration/source-stream-274/exa-public-response.txt",body,{flag:"wx"});
const facts={start,end:new Date().toISOString(),query,status:response.status,contentType:response.headers.get("content-type"),bodyChars:body.length,firstLines:body.split(/\r?\n/).slice(0,3),boundary:"Independent unauthenticated direct public JSON-RPC transport observation after Native closed; not the missing original search response or UI/model acceptance"};
fs.writeFileSync("D:/myhexin-local/opencorvus/.tmp-product-iteration/source-stream-274/exa-public-response-facts.json",JSON.stringify(facts,null,2),{flag:"wx"});
console.log(JSON.stringify({start:facts.start,end:facts.end,status:facts.status,contentType:facts.contentType,bodyChars:facts.bodyChars,prefix:body.slice(0,300)}));