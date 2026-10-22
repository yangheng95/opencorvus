import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/clipboard-literal-525-'
const metadata:any={at:new Date().toISOString(),scope:'Actual source CLI/Provider/physical facts;manual screenshots are observations,not UI assertions',maximumBatchRequests:16,actualRequests:0,unusedRetired:0,stages:[]}
for(const stage of ['before','after']){
 const run=base+stage,response=JSON.parse(fs.readFileSync(root+'/'+stage+'-response-private.json','utf8')),request=JSON.parse(fs.readFileSync(root+'/'+stage+'-request.json','utf8')),audit=JSON.parse(fs.readFileSync(run+'/evidence/provider-final-redacted-private.json','utf8')),original=JSON.parse(fs.readFileSync(root+'/'+stage+'-original-private.json','utf8'))
 const final=audit.requests.find((r:any)=>r.response_reader.requestContext?.activity?.assistantMessageID===response.result.info.id);assert(final)
 const providers=audit.requests.map((r:any)=>{
  const context=r.response_reader.requestContext
  assert.equal(r.model,'gpt-6.1-sol');assert.equal(r.streaming,true);assert.equal(r.status,200);assert.equal(context.streamRequest.modelID,'gpt-6.1-sol');assert.equal(context.streamRequest.apiModelID,'gpt-6.1-sol');assert.equal(r.response_reader.state,'settled');assert.equal(r.response_reader.terminal.kind,'eof')
  return {model:r.model,streaming:r.streaming,status:r.status,sourceReader:r.response_reader}
 })
 const text=response.result.parts.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('\n'),blocks=[...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map(match=>match[1].replace(/\n$/,''))
 const literalMaterials=request.literalMaterials;assert.equal(blocks[0],literalMaterials.first);assert.equal(blocks[1],literalMaterials.second)
 const screenshots=fs.readdirSync(root).filter(name=>/^\d\d-.*\.png$/.test(name)&&(Number(name.slice(0,2))<5)===(stage==='before')).sort().map(name=>{const time=fs.statSync(root+'/'+name).mtimeMs;return {name,fileWriteAt:new Date(time).toISOString(),finalProseReaderAtCapture:time<final.response_reader.firstByteReadAt?'before-final-stream':time<final.response_reader.terminal.at?'reading':'eof',boundary:'File write immediately follows capture;sampled observation,not continuous-frame proof'}})
 const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
 const oldChunk=original.original.memory_chunk.find((row:any)=>row.id==='mck_h0TwOCuDIItgGfxTGf6k'),chunk:any=db.query('SELECT * FROM memory_chunk WHERE id=?').get(oldChunk.id),a=JSON.parse(oldChunk.content),b=JSON.parse(chunk.content)
 const memory={id:chunk.id,oldEnvelopeLength:oldChunk.content.length,newEnvelopeLength:chunk.content.length,oldRevision:a.revision,newRevision:b.revision,oldMarkdownLength:a.markdown.length,newMarkdownLength:b.markdown.length,markdownChanged:a.markdown!==b.markdown,oldTokenCount:oldChunk.token_count,newTokenCount:chunk.token_count,oldAvailabilityGeneration:a.availabilityGeneration,newAvailabilityGeneration:b.availabilityGeneration,meaning:'Natural organizer update to current real member input;not reverted or backfilled'}
 db.close(true)
 const logs=fs.readFileSync(run+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)),main=stage==='before'?'main-DJESc7Su.js':'main-BTerbwsZ.js'
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path==='/ui/assets/'+main&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,status:row.data.statusCode}));assert(assets.some(row=>row.status===200))
 const errors=logs.filter(row=>row.level==='error').map(row=>({time:row.time,service:row.service,message:row.message,errorName:typeof row.data?.error==='object'?row.data.error?.name:undefined}))
 metadata.stages.push({stage,userMessageID:request.body.messageID,assistantMessageID:response.result.info.id,status:response.status,finish:response.result.info.finish,textLength:text.length,headingCount:(text.match(/^### 字符阅读第\d{2}节/gm)||[]).length,codeBlocks:blocks.length,firstTwoCodeBlocks:blocks.slice(0,2),lastCodeBlock:blocks.at(-1),literalMaterials,maximumRequests:audit.maxRequests,actualRequests:audit.requests.length,providers,screenshots,memory,assets,errors})
 metadata.actualRequests+=audit.requests.length;metadata.unusedRetired+=audit.maxRequests-audit.requests.length
}
fs.writeFileSync(root+'/result-observation.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({actualRequests:metadata.actualRequests,maximum:16,unusedRetired:metadata.unusedRetired,stages:metadata.stages.map((s:any)=>({stage:s.stage,textLength:s.textLength,headings:s.headingCount,codeBlocks:s.codeBlocks,screenshots:s.screenshots.map((p:any)=>({name:p.name,phase:p.finalProseReaderAtCapture})),memory:s.memory,errors:s.errors.length}))}))
