import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/goal-reconciliation-admission-499-after-data/runtime/data/opencorvus.db'
const db=new Database(source,{readonly:true,create:false})
try{
 const kinds=db.query('SELECT kind,count(*) AS count FROM engine_artifact GROUP BY kind').all()
 const tasks=db.query(`SELECT t.id,t.project_id,t.session_id,t.time_archived,s.directory,count(a.id) AS artifactCount
 FROM engine_task t JOIN session s ON s.id=t.session_id LEFT JOIN engine_artifact a ON a.task_id=t.id
 WHERE t.time_archived IS NULL AND s.time_archived IS NULL GROUP BY t.id ORDER BY artifactCount DESC,t.time_created DESC`).all()
 fs.writeFileSync(root+'/task-candidates.json',JSON.stringify({source,boundary:'Actual persisted artifact kinds and Task identities,readonly;no fixtures or created data',kinds,tasks},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({kinds,tasks}))
}finally{db.close(true)}
