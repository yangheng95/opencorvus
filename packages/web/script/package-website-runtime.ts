import { copyFile, readdir, rm } from "node:fs/promises"
import path from "node:path"

const webRoot = path.resolve(import.meta.dir, "..")
const serverRoot = path.join(webRoot, "dist", "server")
const entry = path.join(serverRoot, "entry.mjs")
const runtime = path.join(serverRoot, "opencorvus-web.mjs")
const control = path.join(serverRoot, process.platform === "win32" ? "opencorvus-registry-control.exe" : "opencorvus-registry-control")
const seed = path.join(serverRoot, "website-registry-seed.json")
const deployRoot = path.resolve(webRoot, "..", "..", "deploy", "racknerd")

async function run(args: string[]) {
  const child = Bun.spawn(args, { cwd: webRoot, stdout: "inherit", stderr: "inherit" })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`${args.join(" ")} failed with exit code ${exitCode}`)
}

await run([process.execPath, "build", entry, "--target=bun", "--outfile", runtime])
const controlBuild = [
  process.execPath,
  "build",
  path.join(webRoot, "script", "website-registry-control.ts"),
  "--compile",
  "--outfile",
  control,
]
if (process.env.OPENCORVUS_REGISTRY_CONTROL_TARGET) controlBuild.splice(-2, 0, `--target=${process.env.OPENCORVUS_REGISTRY_CONTROL_TARGET}`)
await run(controlBuild)
await copyFile(path.join(webRoot, ".generated", "website-registry-seed.json"), seed)
await copyFile(path.join(deployRoot, "Caddyfile"), path.join(serverRoot, "Caddyfile"))
await copyFile(path.join(deployRoot, "opencorvus-web.service"), path.join(serverRoot, "opencorvus-web.service"))
await copyFile(path.join(deployRoot, "opencorvus-activate-release"), path.join(serverRoot, "opencorvus-activate-release"))
await copyFile(path.join(deployRoot, "deploy-signing-public.pem"), path.join(serverRoot, "deploy-signing-public.pem"))
await copyFile(path.join(deployRoot, "opencorvus-registry-backup"), path.join(serverRoot, "opencorvus-registry-backup"))
await copyFile(path.join(deployRoot, "opencorvus-registry-backup.service"), path.join(serverRoot, "opencorvus-registry-backup.service"))
await copyFile(path.join(deployRoot, "opencorvus-registry-backup.timer"), path.join(serverRoot, "opencorvus-registry-backup.timer"))
await copyFile(path.join(deployRoot, "opencorvus-deploy.sudoers"), path.join(serverRoot, "opencorvus-deploy.sudoers"))

for (const entryName of await readdir(serverRoot)) {
  if ([path.basename(runtime), path.basename(control), path.basename(seed), "Caddyfile", "opencorvus-web.service", "opencorvus-activate-release", "deploy-signing-public.pem", "opencorvus-registry-backup", "opencorvus-registry-backup.service", "opencorvus-registry-backup.timer", "opencorvus-deploy.sudoers"].includes(entryName)) continue
  await rm(path.join(serverRoot, entryName), { recursive: true, force: true })
}

console.log(`Packaged website runtime: ${path.relative(webRoot, runtime)}, ${path.relative(webRoot, control)}`)
