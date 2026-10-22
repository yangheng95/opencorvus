import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,original=JSON.parse(fs.readFileSync(root+'/after-original-private.json','utf8')),db=new Database(original.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const messages=original.original.message.filter((m:any)=>['msg_g0VYlzS0o00hw95ax6fk','msg_g0VYm1mFw007S5Hh2wBH'].includes(m.id)).map((m:any)=>{const actual=db.query('SELECT * FROM message WHERE id=?').get(m.id) as any,prior=JSON.parse(m.data),current=JSON.parse(actual.data);return {id:m.id,sessionID:m.session_id,prior:{time:prior.time,finish:prior.finish,error:prior.error},current:{time:current.time,finish:current.finish,error:current.error}}})
 const owners=db.query('SELECT * FROM session_prompt_owner WHERE project_id IN (?,?)').all('prj_hp1ir9XEheMHTOMlkSL8','prj_hqstF38LMYVEi0PQVcXc')
 const memory=original.original.memory_file.filter((r:any)=>['mem_h6r23eQkVxF8ppMaNuxh','mem_hHejPV6qWDfwx9DqBbzt','mem_hzsR2SHhfvmqd3ZLHXeg'].includes(r.id)).map((r:any)=>({id:r.id,projectID:r.project_id,kind:r.kind,source:r.source,key:r.key,retained:!!db.query('SELECT id FROM memory_file WHERE id=?').get(r.id)}))
 const result={at:new Date().toISOString(),messages,owners,memory};fs.writeFileSync(root+'/original-row-facts.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{db.close(true)}
