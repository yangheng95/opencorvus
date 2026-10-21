import fs from 'node:fs'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import * as before from './secret-scan-before.ts'
import * as after from '../../script/secret-scan.ts'
const root=import.meta.dirname,repo=root+'/crlf';assert.equal(fs.existsSync(repo),false);fs.mkdirSync(repo)
const env={...process.env};for(const name of Object.keys(env))if(name.startsWith('GIT_'))delete env[name]
function git(args,input){const r=spawnSync('git',['-C',repo,'-c','user.name=Index Fixture','-c','user.email=index@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath='+repo+'/empty-hooks',...args],{input,env,windowsHide:true,maxBuffer:8*1024*1024});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr.toString());return r.stdout.toString().trim()}
git(['init','--initial-branch=index-fixture']);git(['config','core.autocrlf','true'])
fs.writeFileSync(repo+'/base.ts','public baseline\n');git(['add','base.ts']);git(['commit','-m','public baseline'])
const fake='sk-'+'IndexFixture'.repeat(3),body=fake+'\r\n'+'x\r\n'.repeat(400000)
fs.writeFileSync(repo+'/normalized.ts',body);git(['add','normalized.ts'])
const old=before.listTrackedEntries(repo).find(r=>r.file==='normalized.ts'),current=after.listTrackedEntries(repo).find(r=>r.file==='normalized.ts'),actual=Number(git(['cat-file','-s',current.objectId]))
assert.equal(current.size,actual);assert(old.size>1024*1024);assert(actual<1024*1024)
const beforeHits=before.scan({repoRoot:repo}),afterHits=after.scan({repoRoot:repo})
assert.deepEqual(afterHits,[{file:'normalized.ts',lineNumber:1,patternId:'provider-key',description:'Model-provider key (sk-...)'}])
const result={observedAt:new Date().toISOString(),repo,workingBytes:Buffer.byteLength(body),beforeEntry:old,afterEntry:current,actualBlobBytes:actual,beforeHits,afterHits,rootCause:'Working-copy stat exceeds1MiB but actual normalized staged blob is below1MiB;old cached-size filter misses it',credential:'Generated fake only;no actual authority or Provider'}
fs.writeFileSync(root+'/crlf-reproduction.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({workingBytes:result.workingBytes,cachedBytes:old.size,actualBlobBytes:actual,beforeFindings:beforeHits.length,afterFindings:afterHits.length}))
