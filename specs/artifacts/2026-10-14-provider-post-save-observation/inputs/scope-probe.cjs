const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-post-save-01a133/final');
const before=JSON.parse(fs.readFileSync(root+'/lease-scope-auth-ready.json','utf8'));
const after=JSON.parse(fs.readFileSync(root+'/runtime/data/auth.json','utf8'));
const entry=after['owned-global-partial'];assert.equal(entry.info.type,'api');assert.equal(entry.info.key,after['owned-bootstrap'].info.key);
const source=JSON.parse(fs.readFileSync(root+'/runtime/config/opencorvus.jsonc','utf8'));assert.equal(source.provider['owned-global-partial'].name,'Owned original global scope');
const record={providerID:'owned-global-partial',sourceName:source.provider['owned-global-partial'].name,beforeGeneration:before.credentialGenerations['owned-global-partial'],acceptedGeneration:entry.generation,type:entry.info.type,keyMatchesOwnedParticipant:true,boundary:'Real accepted original Auth mutation settled after native global-project-global selection; generation metadata only, current draft checked manually in original screenshot'};
fs.writeFileSync(root+'/scope-accepted-original.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
