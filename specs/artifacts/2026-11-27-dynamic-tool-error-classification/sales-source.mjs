import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
const root=process.argv[2], log=process.argv[3]
if(!root||!log)throw new Error('Owned source root and call record required')
const send=value=>process.stdout.write(JSON.stringify(value)+'\n')
readline.createInterface({input:process.stdin}).on('line',async line=>{
 const request=JSON.parse(line); if(request.id===undefined)return
 const base={jsonrpc:'2.0',id:request.id}
 if(request.method==='initialize')return send({...base,result:{protocolVersion:'2025-06-18',capabilities:{tools:{},prompts:{},resources:{}},serverInfo:{name:'owned-sales-source',version:'1'}}})
 if(['prompts/list','resources/list'].includes(request.method))return send({...base,result:request.method==='prompts/list'?{prompts:[]}:{resources:[]}})
 if(request.method==='tools/list')return send({...base,result:{tools:[{name:'read_sales_source',description:'Read the exact UTF-8 sales source file from the authorized project. Returns real file text; missing sources are explicit protocol errors.',inputSchema:{type:'object',properties:{filename:{type:'string'}},required:['filename'],additionalProperties:false}}]}})
 if(request.method==='tools/call'){
  const name=request.params?.arguments?.filename
  if(typeof name!=='string'||path.basename(name)!==name)return send({...base,error:{code:-32602,message:'A source basename is required'}})
  try{
   const text=await fs.readFile(path.join(root,name),'utf8')
   await fs.appendFile(log,JSON.stringify({filename:name,outcome:'read',bytes:Buffer.byteLength(text),at:Date.now()})+'\n')
   return send({...base,result:{content:[{type:'text',text}]}})
  }catch(error){
   const code=typeof error.code==='string'?error.code:'SOURCE_READ_FAILED'
   await fs.appendFile(log,JSON.stringify({filename:name,outcome:'error',code,at:Date.now()})+'\n')
   return send({...base,error:{code:-32603,message:`Sales source ${name}: ${code}`,data:{filename:name,code}}})
  }
 }
 send({...base,error:{code:-32601,message:'Unsupported method'}})
})
