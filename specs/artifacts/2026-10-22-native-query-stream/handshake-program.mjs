import fs from 'node:fs'
const gate=process.argv[2]
process.stdout.write('early\n')
const started=Date.now()
while(!fs.existsSync(gate)){
 if(Date.now()-started>3000){process.stderr.write('ACK deadline\n');process.exit(23)}
 await new Promise(resolve=>setTimeout(resolve,10))
}
process.stdout.write('late\n');process.stderr.write('done 中文\n');process.exitCode=7
