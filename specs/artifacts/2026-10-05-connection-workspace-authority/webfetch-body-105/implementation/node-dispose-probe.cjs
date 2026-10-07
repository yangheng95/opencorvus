const fs = require('node:fs');
const http = require('node:http');
const ts = require('../../packages/opencorvus/node_modules/typescript');
const source = fs.readFileSync(process.argv[2] || 'packages/opencorvus/src/util/http-response-body.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
(async()=>{
 const {fetchHttpResponseOwner,disposeHttpResponseBody}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const events=[];const sockets=new Set();const closes=[];const timers=[];
 const server=http.createServer((req,res)=>{events.push('request');req.on('aborted',()=>events.push('request_aborted'));res.on('finish',()=>events.push('finish'));res.writeHead(403,{'transfer-encoding':'chunked'});res.write('first');timers.push(setTimeout(()=>{if(!res.destroyed)res.end('finite')},250));});
 server.on('connection',s=>{sockets.add(s);closes.push(new Promise(r=>s.once('close',()=>{events.push('socket_close');sockets.delete(s);r()})))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let requestSignal;let result;
 try{const owner=await fetchHttpResponseOwner(signal=>{requestSignal=signal;return fetch('http://127.0.0.1:'+server.address().port,{signal})},new AbortController().signal);try{await disposeHttpResponseBody(owner);result={settled:'fulfilled'}}catch(e){result={settled:'rejected',samePrimary:e===requestSignal.reason,name:e.name,message:e.message}}await Promise.all(closes)}finally{timers.forEach(clearTimeout);await new Promise(r=>server.close(r));server.closeAllConnections();for(const s of sockets)s.destroy();await Promise.all(closes)}
 console.log(JSON.stringify({node:process.version,result,events,liveSockets:sockets.size,joined:closes.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
