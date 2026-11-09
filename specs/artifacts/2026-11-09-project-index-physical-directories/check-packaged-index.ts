import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { artifactCompileDefines, artifactEmbeddedExecutableRelativePaths } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/script/build-artifact.ts"
import { copyProjectIndexRuntime } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/script/build-runtime-binaries.ts"

const root = process.argv[2]
const bundle = path.join(root, "package-proof")
const exe = path.join(bundle, "packaged-index-smoke.exe")
const source = path.join(root, "packaged-index-entry.ts")
const host = { platform: process.platform, arch: process.arch }
const target = { os: process.platform, arch: process.arch }
assert.equal(host.platform, "win32")
await fs.mkdir(bundle, { recursive: true })
const copied = await copyProjectIndexRuntime({ host, target, outdir: bundle })
assert.ok(artifactEmbeddedExecutableRelativePaths().includes(path.relative(bundle, copied)))
const built = await Bun.build({
  entrypoints: [source],
  plugins: [{
    name: "resolve-local-smoke-inputs",
    setup(builder) {
      builder.onResolve({ filter: /^opencorvus-smoke:(compiled-binary|project-index)\.ts$/ }, ({ path: specifier }) => ({
        path: path.resolve("D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime", specifier.slice("opencorvus-smoke:".length)),
      }))
    },
  }],
  compile: { outfile: exe, autoloadBunfig: false, autoloadDotenv: false },
  define: artifactCompileDefines({ channel: "local", embeddedEnv: "{}", libc: "''", version: "0.1.48" }),
})
assert.ok(built.success, String(built.logs))
const result = spawnSync(exe, [], { cwd: path.join(root, "project-after"), encoding: "utf8", windowsHide: true })
assert.equal(result.status, 0, result.stderr)
const output = JSON.parse(result.stdout)
assert.equal(output.executable, copied)
assert.deepEqual(output.directories, ["opal-empty","opal-nested","opal-nested\\opal-empty-child","opal-occupied"])
assert.deepEqual(output.files, ["opal-occupied\\opal-note.txt"])
const missingBundle = path.join(root, "package-missing-proof")
await fs.mkdir(missingBundle, { recursive: true })
const missingExe = path.join(missingBundle, "packaged-index-smoke.exe")
await fs.copyFile(exe, missingExe)
const failure = spawnSync(missingExe, [], { cwd: path.join(root, "project-after"), encoding: "utf8", windowsHide: true })
const missingRuntime = path.join(missingBundle, "bin", "opencorvus-project-index.exe")
assert.equal(failure.status, 1)
assert.ok(failure.stderr.includes("Project index runtime is missing at " + missingRuntime + "."), failure.stderr)
const receipt = { compileMode: "Windows compiled smoke entrypoint with production definitions", stage: path.relative(bundle, copied), ...output, missingRuntime: { exitCode: failure.status, expectedLocation: missingRuntime } }
await fs.writeFile(path.join(root, "packaged-index-check.json"), JSON.stringify(receipt,null,2)+"\n")
console.log(JSON.stringify(receipt))