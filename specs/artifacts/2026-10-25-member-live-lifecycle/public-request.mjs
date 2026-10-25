import http from 'node:http'

// One original caller. The activity owner supplies cancellation; no additional
// elapsed response-header deadline may terminate a still-progressing prompt.
export async function publicJsonRequest(url, body, signal) {
  const bytes=Buffer.from(JSON.stringify(body))
  return new Promise((resolve,reject)=>{
    const request=http.request(url,{method:'POST',agent:false,timeout:0,signal,headers:{'content-type':'application/json','content-length':bytes.length}},async response=>{
      try {
        const chunks=[]
        for await(const chunk of response)chunks.push(chunk)
        resolve({status:response.statusCode,payload:JSON.parse(Buffer.concat(chunks).toString('utf8')),reader:'eof'})
      } catch(error){reject(error)}
    })
    request.on('error',reject)
    request.end(bytes)
  })
}
