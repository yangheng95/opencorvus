import fs from 'node:fs'
const stage=process.argv[2]??'before',root=import.meta.dirname,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/live-member-concurrency-508-'+stage
const name=fs.readdirSync(run+'/evidence').filter(n=>/^provider-.*-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)[1])-Number(b.match(/-(\d+)\.json$/)[1])).at(-1)
const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+name,'utf8'))
const entries=audit.requests.map((r,index)=>({request:index+1,model:r.model,streaming:r.streaming,status:r.status,...r.response_reader}))
const accepted=JSON.parse(fs.readFileSync(root+'/'+stage+'-task-create-response.json','utf8')).result; const observed=fs.readdirSync(root).filter(n=>/^task-observation-\d+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(root+'/'+n,'utf8'))).filter(v=>v.owner.task_id===accepted.task_id).at(-1); const members=observed.sessions.filter(s=>s.kind==='explore').map(s=>s.id)
const intervals=entries.filter(r=>members.includes(r.requestContext?.sessionID)).map(r=>({request:r.request,sessionID:r.requestContext.sessionID,messageID:r.requestContext.activity?.assistantMessageID,requestID:r.requestContext.streamRequest?.requestID,boundAt:r.boundAt,firstByteReadAt:r.firstByteReadAt,lastByteReadAt:r.lastByteReadAt,terminal:r.terminal,chunkCount:r.chunkCount,byteCount:r.byteCount}))
const overlap=[]
for(const a of intervals.filter(r=>r.sessionID===members[0]))for(const b of intervals.filter(r=>r.sessionID===members[1])){
 const start=Math.max(a.boundAt,b.boundAt),end=Math.min(a.terminal?.at??0,b.terminal?.at??0)
 if(end>start)overlap.push({a:a.request,b:b.request,start,end,readerOverlapMilliseconds:end-start})
}
const result={observedAt:new Date().toISOString(),maximum:audit.maxRequests,actual:entries.length,exhausted:audit.exhausted,entries,memberIntervals:intervals,memberOverlaps:overlap}
fs.writeFileSync(root+'/'+stage+'-provider-description-private.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({maximum:result.maximum,actual:result.actual,exhausted:result.exhausted,memberIntervals:intervals,memberOverlaps:overlap,readers:entries.map(r=>({request:r.request,state:r.state,terminal:r.terminal?.kind}))}))

