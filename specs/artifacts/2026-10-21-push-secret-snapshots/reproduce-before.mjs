import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const root=import.meta.dirname,repo=path.join(root,'reproduction'),bun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/dependency-redirect-hardening-488-after-bundle/bin/bun.exe'
assert.equal(fs.existsSync(repo),false);fs.mkdirSync(repo)
const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key]
function git(args,input){const result=spawnSync('git',['-C',repo,'-c','user.name=Scanner Fixture','-c','user.email=scanner@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath='+repo+'/empty-hooks',...args],{input,env,windowsHide:true,maxBuffer:16*1024*1024});if(result.error)throw result.error;assert.equal(result.status,0,result.stderr.toString());return result.stdout}
git(['init','--initial-branch=qa-fixture'])
fs.writeFileSync(repo+'/secrets.ts',"export const mode = 'public'\n");git(['add','secrets.ts']);git(['commit','-m','public baseline']);const base=git(['rev-parse','HEAD']).toString().trim()
const fake='sk-'+'QAExample'.repeat(5),body="export const token = '"+fake+"'\n"
fs.writeFileSync(repo+'/secrets.ts',body);git(['add','secrets.ts']);git(['commit','-m','fixture intermediate content']);const intermediate=git(['rev-parse','HEAD']).toString().trim()
fs.writeFileSync(repo+'/secrets.ts',"export const mode = 'public again'\n");git(['add','secrets.ts']);git(['commit','-m','public final snapshot']);const tip=git(['rev-parse','HEAD']).toString().trim()
fs.mkdirSync(repo+'/script');fs.copyFileSync(root+'/secret-scan-before.ts',repo+'/script/secret-scan.ts',fs.constants.COPYFILE_EXCL)
const input=`refs/heads/qa-fixture ${tip} refs/heads/qa-fixture ${base}\n`,cli=spawnSync(bun,[repo+'/script/secret-scan.ts','--pre-push-stdin'],{input,env,cwd:repo,windowsHide:true,encoding:'utf8',maxBuffer:1024*1024})
if(cli.error)throw cli.error
assert.equal(cli.status,0);assert.equal(cli.stdout.trim(),'[secret-scan] OK — 0 hits across tracked sources')
const {scan}=await import('./secret-scan-before.ts'),middleHits=scan({repoRoot:repo,refs:[intermediate]})
assert.equal(middleHits.length,1);assert.equal(middleHits[0].file,'secrets.ts');assert.equal(middleHits[0].patternId,'provider-key')
assert.equal(git(['show',intermediate+':secrets.ts']).toString(),body)
const raw=git(['diff-tree','--stdin','--root','-r','-m','--no-renames','--raw','--no-abbrev','--no-commit-id','-z'],intermediate+'\n'+tip+'\n')
fs.writeFileSync(root+'/diff-tree-original.bin',raw,{flag:'wx'})
const result={observedAt:new Date().toISOString(),fixture:repo,base,intermediate,tip,prePushInput:input,originalCLI:{status:cli.status,stdout:cli.stdout,stderr:cli.stderr},actualIntermediateHits:middleHits,intermediateBytes:Buffer.byteLength(body),diffTreeRecords:raw.toString().split('\0').filter(Boolean),credential:'Generated fake shape only;no actual credential or Provider request',rootCause:'Original pre-push parser discards remote baseline and scans local tip/index,while an actual pushed intermediate commit contains a recognized key'}
fs.writeFileSync(root+'/before-reproduction.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({originalCLIStatus:cli.status,actualIntermediateHits:middleHits.map(h=>({file:h.file,lineNumber:h.lineNumber,patternId:h.patternId})),diffTreeRecords:result.diffTreeRecords,modelRequests:0}))
