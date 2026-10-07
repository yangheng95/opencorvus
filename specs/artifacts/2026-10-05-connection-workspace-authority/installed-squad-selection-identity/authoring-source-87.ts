import path from "node:path"
import { mkdir } from "node:fs/promises"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "../packages/sdk/js/src/expert-squad-authoring.ts"
const outputArg = process.argv[2]
if (!outputArg) throw new Error("Usage: bun installed-selection-87-authoring.ts <OutputRoot>")
const outputRoot = path.resolve(outputArg)
const admitted = path.resolve("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/installed-selection-before-87/authoring")
if (outputRoot !== admitted) throw new Error("OutputRoot must be the admitted isolated authoring directory")
await mkdir(outputRoot, { recursive: true })
const sources: Array<{id:string;namespace:string;sourceDirectory:string}> = []
for (let index=1; index<=21; index++) {
 const id=`selection-squad-${String(index).padStart(3,"0")}`
 const definition: ExpertSquadPackageDefinition = {
  manifest: {schema_version:2,namespace:"selection-check",id,label:`Selection Squad ${String(index).padStart(3,"0")}`,description:"Isolated installed selection identity observation package.",version:"2026.10.07.1",product_pillars:["code"],readme:"README.md",selector:{summary:"Isolated installed selection observation.",selection_guidance:"Use only for the owned selection observation.",instructions:"selector.md"},capability_sets:{},capability_projection:{scheduler:{base_role:"orchestrator",capability_refs:[]},agents:{},virtual_workflows:{}}},
  files:{"README.md":`# Selection Squad ${index}\n\nOwned source package for catalogue selection observation. No model task is requested.\n`,"selector.md":"# Selection observation\n\nInspect this package only in the owned selection acceptance workspace.\n"}
 }
 const sourceDirectory=path.join(outputRoot,id)
 await writeExpertSquadPackage({directory:sourceDirectory,definition})
 sources.push({id,namespace:definition.manifest.namespace,sourceDirectory})
}
console.log(JSON.stringify({outputRoot,count:sources.length,version:"2026.10.07.1",sources},null,2))
