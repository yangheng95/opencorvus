let size=0
for await(const chunk of process.stdin)size+=chunk.length
if(size!==1024*1024)throw Error('Complete original stdin required')
await Promise.all([
 new Promise((resolve,reject)=>process.stdout.write('O'.repeat(2*1024*1024),error=>error?reject(error):resolve())),
 new Promise((resolve,reject)=>process.stderr.write('E'.repeat(512*1024),error=>error?reject(error):resolve())),
])
