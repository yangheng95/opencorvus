import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { Database } from "bun:sqlite"
const manifest=JSON.parse(fs.readFileSync(process.argv[2],"utf8"))
const db=new Database(path.join(manifest.sourceRun,"runtime/data/opencorvus.db"),{readonly:true})
const git=(...args:string[])=>execFileSync("git",["--no-optional-locks",...args],{cwd:manifest.sourceProject,encoding:"utf8"})
db.exec("BEGIN")
try {
 const checkpoints=(db.query("SELECT r.id,r.task_id,r.stage,r.time_created AS requested_at,o.result,o.time_created AS completed_at FROM engine_git_checkpoint_request r JOIN engine_git_checkpoint_outcome o ON o.request_id=r.id WHERE r.task_id=? ORDER BY r.time_created,r.id").all(manifest.taskID) as any[]).map(row=>({...row,result:JSON.parse(row.result)}))
 const result={observedAtUtc:new Date().toISOString(),project:manifest.sourceProject,taskID:manifest.taskID,head:git("rev-parse","HEAD").trim(),index:git("ls-files","--stage","-z").split("\0").filter(Boolean),tree:git("ls-tree","-r","-z","HEAD").split("\0").filter(Boolean),status:git("status","--porcelain=v1","-z","--untracked-files=all"),checkpoints,boundary:"Current real immutable Git tree/index and original canonical Task checkpoints; no timestamp restoration and no expected source checksum."}
 fs.writeFileSync(path.join(manifest.caseEvidence,"index-observation.json"),JSON.stringify(result,null,2)+"\n",{flag:"wx"})
 console.log(JSON.stringify(result,null,2))
} finally {db.exec("ROLLBACK");db.close()}
