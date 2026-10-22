import path from 'node:path'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..');process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/clipboard-literal-525-after-bundle/bin/ui'}})
