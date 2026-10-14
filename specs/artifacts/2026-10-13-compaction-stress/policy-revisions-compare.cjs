const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Database}=require('bun:sqlite');
const root=path.resolve('specs/artifacts/2026-10-13-compaction-stress');
const names=['cross-model-policy-revisions','cross-model-policy-revisions-range','cross-model-policy-revisions-sol'];
const runs=names.map(name=>JSON.parse(fs.readFileSync(path.join(root,name+'-role-evidence.json'),'utf8')));
function authored(name){
 const r=JSON.parse(fs.readFileSync(path.join(root,name+'.json'),'utf8'));
 const db=new Database(path.join(r.runtime,'runtime/data/opencorvus.db'),{readonly:true});
 const messages=db.query('SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id').all(r.cases[0].sessionID)
  .map(row=>({id:row.id,...JSON.parse(row.data)})).filter(info=>info.author!=='compaction').map(info=>{
   const text=db.query('SELECT data FROM part WHERE message_id=? ORDER BY time_created,id').all(info.id)
    .map(row=>JSON.parse(row.data)).filter(part=>part.type==='text').map(part=>part.text);
   const tools=db.query('SELECT r.data AS request,o.data AS outcome FROM tool_part_request r JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE r.message_id=? ORDER BY r.time_created,r.id').all(info.id).map(row=>{
    const request=JSON.parse(row.request),outcome=JSON.parse(row.outcome);assert.equal(outcome.outcome,'completed');
    return {tool:request.tool,input:request.input,output:outcome.output};
   });
   return {role:info.role,author:info.author,text,tools};
  });db.close();return messages;
}
const luna=authored(names[1]),sol=authored(names[2]);assert.deepEqual(luna,sol);
const comparison={status:'exact_authored_content_match',left:names[1],right:names[2],messages:luna.length,
 textCharacters:luna.reduce((n,m)=>n+m.text.reduce((s,t)=>s+t.length,0),0),toolResults:luna.reduce((n,m)=>n+m.tools.length,0),
 scope:'Exact canonical authored roles, authors, text and Tool input/output in timeline order. Execution IDs/times/model metadata and model-generated compactor messages naturally differ.'};
fs.writeFileSync(path.join(root,'policy-revisions-matched-corpus.json'),JSON.stringify(comparison,null,2)+'\n');
const result={status:'failed',reason:'Residual Luna incomplete-read and action failures remain; Sol success does not erase them.',
 priorRequests:769,phaseRequests:runs.reduce((n,r)=>n+r.requests,0),total:769+runs.reduce((n,r)=>n+r.requests,0),
 comparison,runs:runs.map(({cases,...run})=>run),localContracts:43,inputErrorQualifications:2,
 limits:['Authored five-round histories, not a statistical model ranking.','Per-model defaults and naturally different execution histories; no product model switch or fallback.','Physical crash, larger scale, native product state and cross-vendor fidelity remain open.']};
assert.equal(result.total,999);fs.writeFileSync(path.join(root,'policy-revisions-matrix-summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
