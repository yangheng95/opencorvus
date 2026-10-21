import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',authority=base+'/real-deliverable-review-501-authority'
assert.equal(fs.existsSync(authority),false,'Fresh private authority occurrence')
const source='C:/Users/hengu/.codex/auth.json',catalogSource='C:/Users/hengu/AppData/Local/opencorvus/data/models.json'
const bytes=fs.readFileSync(source),stat=fs.statSync(source),raw=JSON.parse(bytes),tokens=raw.tokens
assert.equal(typeof tokens?.access_token,'string');assert.equal(typeof tokens?.refresh_token,'string')
const claims=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url'))
assert(Number.isFinite(claims.exp)&&claims.exp*1000>Date.now()+1200000,'Current copied access required;no refresh or exchange')
const models=fs.readFileSync(catalogSource),catalog=JSON.parse(models)
assert(catalog.openai.models['gpt-6.1-sol'],'Complete source catalog projects target model')
fs.mkdirSync(authority,{recursive:true})
const info={type:'oauth',access:tokens.access_token,refresh:tokens.refresh_token,expires:claims.exp*1000,accountId:tokens.account_id}
fs.writeFileSync(authority+'/auth.json',JSON.stringify({openai:{generation:crypto.randomUUID(),info}}),{flag:'wx',mode:0o600})
fs.writeFileSync(authority+'/models.json',models,{flag:'wx',mode:0o600})
assert(fs.readFileSync(source).equals(bytes),'Source credential bytes retained')
assert.equal(fs.statSync(source).mtimeMs,stat.mtimeMs)
fs.writeFileSync(root+'/authority-preparation.json',JSON.stringify({observedAt:new Date().toISOString(),authority,source,sourceBytes:stat.size,sourceModifiedAtMs:stat.mtimeMs,copiedAccessExpiresAt:new Date(claims.exp*1000).toISOString(),catalogSource,catalogBytes:models.length,catalogProviders:Object.keys(catalog).length,catalogModels:Object.values(catalog).reduce((n,p)=>n+Object.keys(p.models).length,0),targetModel:'gpt-6.1-sol',maximumBatchRequests:12,scopeBudgets:{before:12},operation:'Fresh selected complete OpenAI entry plus exact full adjacent catalog;source unchanged;no refresh/exchange or model request'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({authority:'fresh complete paired',access:'current',targetModel:'gpt-6.1-sol',source:'unchanged',maximumBatchRequests:12}))
