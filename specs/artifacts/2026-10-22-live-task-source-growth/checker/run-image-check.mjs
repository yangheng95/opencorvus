import {spawnSync} from 'node:child_process'
import path from 'node:path'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',run=base+'/live-task-source-growth-537-after'
const input=run+'/runtime/data/projects/2026/10/22/7f6e95df-9037-456b-a2f2-d67cf237dfe5/.opencorvus/.r/project/attachments/64ca8075d122d75e2da9cc777c5b4828251c7e76cde71c85fafabd57623d7e86/b4a9ca9e1cfc475c07592c9527eeea28ed6fc0ea38401060d9243a36eb6c845c.png'
const result=spawnSync(base+'/live-task-source-growth-537-after-bundle/bin/bun.exe',[root+'/check-original-image.ts',input,root+'/repaired-original-image-check.json'],{cwd:path.resolve(root,'../..'),env:{...process.env,OPENCORVUS_HOME:run+'/runtime'},timeout:30000,encoding:'utf8',maxBuffer:65536})
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr)
if(result.error)throw result.error
process.exitCode=result.status??1
