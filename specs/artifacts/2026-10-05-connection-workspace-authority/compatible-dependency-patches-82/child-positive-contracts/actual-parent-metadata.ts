import {createRequire} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
const root=createRequire(new URL('../../package.json',import.meta.url))
const backend=createRequire(new URL('../../packages/opencorvus/package.json',import.meta.url))
const overlay=createRequire(new URL('../../packages/overlay/package.json',import.meta.url))
const web=createRequire(new URL('../../packages/web/package.json',import.meta.url))
const astro=createRequire(web.resolve('astro/package.json'))
const sdk=createRequire(backend.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js'))
const search=createRequire(backend.resolve('open-websearch/build/engines/bing/bing.js'))
function metadata(parent:ReturnType<typeof createRequire>, name:string,owner:string){const entry=parent.resolve(name);let directory=path.dirname(entry);while(true){const candidate=path.join(directory,'package.json');if(existsSync(candidate)){const info=JSON.parse(readFileSync(candidate,'utf8'));if(info.name===name)return {owner,name,version:info.version,entry,packagePath:candidate}} const next=path.dirname(directory);if(next===directory)throw new Error('Package metadata not found');directory=next}}
const rows=[metadata(root,'sharp','root'),metadata(createRequire(overlay.resolve('solid-js')),'seroval','Overlay Solid'),metadata(createRequire(web.resolve('solid-js')),'seroval','Web Solid'),metadata(astro,'smol-toml','Astro'),metadata(createRequire(sdk.resolve('express')),'proxy-addr','SDK Express'),metadata(createRequire(search.resolve('express')),'proxy-addr','Search Express'),metadata(createRequire(createRequire(overlay.resolve('vite/package.json')).resolve('postcss')),'source-map-js','Vite PostCSS'),metadata(createRequire(astro.resolve('magicast')),'source-map-js','Astro Magicast')]
console.log(JSON.stringify({runtime:process.versions,rows,sharpVersions:root('sharp').versions},null,2))
