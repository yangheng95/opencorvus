import fs from 'node:fs'
const root=import.meta.dirname,response=JSON.parse(fs.readFileSync(root+'/before-response-private.json','utf8'))
const texts=response.result.parts.filter(p=>p.type==='text').map(p=>p.text),text=texts.at(-1)
const facts={status:response.status,assistant:response.result.info.id,finish:response.result.info.finish,completed:response.result.info.time.completed,textLengths:texts.map(t=>t.length),sectionCount:(text.match(/^## 第\d+节/gm)||[]).length,referenceDefinitionOffset:text.lastIndexOf('[member503-reference]:'),definitionHasBlankLine:text.includes('\n\n[member503-reference]:'),tail:text.slice(-180),boundary:'Description of the actual model result only;not a UI assertion or a substitute for visible link review'}
fs.writeFileSync(root+'/before-response-description.json',JSON.stringify(facts,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(facts))
