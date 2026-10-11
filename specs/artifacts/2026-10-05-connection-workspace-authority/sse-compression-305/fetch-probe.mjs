import http from 'node:http'
import { createGzip, createDeflate, createBrotliCompress, constants, gzipSync } from 'node:zlib'
const server=http.createServer((req,res)=>{
 const encoding=process.argv.includes('--deflate')?'deflate':process.argv.includes('--br')?'br':'gzip'
 res.writeHead(200,{'content-type':'text/event-stream','content-encoding':encoding})
 if(process.argv.includes('--members')){
  res.write(gzipSync('data: first\n\n'))
  const timer=setTimeout(()=>res.end(gzipSync('data: last\n\n')),1200)
  res.on('close',()=>clearTimeout(timer))
  return
 }
 const gzip=encoding==='deflate'?createDeflate({flush:constants.Z_SYNC_FLUSH}):encoding==='br'?createBrotliCompress({flush:constants.BROTLI_OPERATION_FLUSH}):createGzip({flush:constants.Z_SYNC_FLUSH});gzip.pipe(res)
 gzip.write('data: first\n\n')
 const timer=setTimeout(()=>gzip.end('data: last\n\n'),1200)
 res.on('close',()=>{clearTimeout(timer);gzip.destroy()})
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
try{
 const start=performance.now()
 const response=await fetch('http://127.0.0.1:'+server.address().port,{headers:{'accept-encoding':'gzip, deflate, br'}})
 const headersAt=performance.now()-start
 const reader=response.body.getReader();const first=await reader.read()
 console.log(JSON.stringify({runtime:process.versions.bun?'bun':'node',headersAt,firstAt:performance.now()-start,text:new TextDecoder().decode(first.value)}))
 await reader.cancel()
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
