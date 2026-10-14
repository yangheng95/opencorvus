const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),zlib=require('node:zlib'),{Database}=require('bun:sqlite');const root='specs/artifacts/2026-10-13-compaction-stress';
const names=process.argv.slice(2);if(!names.length)names.push('catalog-evidence-sol','catalog-evidence-luna');
for(const name of names) {
 assert(/^(catalog-evidence-(sol|luna)|hierarchy-catalog-(sol|luna)(-retry)?)$/.test(name));
 const r=JSON.parse(fs.readFileSync(root+'/'+name+'.json','utf8')),sessionID=r.cases[0].sessionID;
 const relative=path.relative(os.tmpdir(),r.runtime);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(r.runtime).startsWith('opencorvus-compaction-stress-'));
 const db=new Database(path.join(r.runtime,'runtime/data/opencorvus.db'),{readonly:true});
 const messages=db.query('SELECT * FROM message WHERE session_id=? ORDER BY time_created,id').all(sessionID),ids=new Set(messages.map(m=>m.id));
 const facts={messages,parts:db.query('SELECT * FROM part ORDER BY time_created,id').all().filter(p=>ids.has(p.message_id)),requests:db.query('SELECT * FROM tool_part_request ORDER BY time_created,id').all().filter(p=>ids.has(p.message_id)),outcomes:db.query('SELECT * FROM tool_part_outcome ORDER BY time_created,request_part_id').all(),usage:db.query('SELECT id,provider_id,model_id,occurred_at FROM provider_usage_event ORDER BY occurred_at,id').all(),controls:db.query('SELECT * FROM session_control_record WHERE session_id=? ORDER BY time_created,id').all(sessionID)};
 const controls=new Set(facts.controls.map(c=>c.id));facts.controlEvents=db.query('SELECT * FROM session_control_event ORDER BY time_created,id').all().filter(e=>controls.has(e.control_id));
 db.close();
 for(const suffix of ['.json','.json.requests.json'])fs.writeFileSync(root+'/'+name+suffix+'.gz',zlib.gzipSync(fs.readFileSync(root+'/'+name+suffix)));
 fs.writeFileSync(root+'/'+name+'-facts.json.gz',zlib.gzipSync(JSON.stringify(facts)));
 console.log(JSON.stringify({name,messages:facts.messages.length,toolRequests:facts.requests.length,usage:facts.usage.length,credentialCopiesRemoved:['auth.json','models.json'].every(f=>!fs.existsSync(path.join(r.runtime,'runtime/data',f)))}));
}
