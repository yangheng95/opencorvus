import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { pathToFileURL } from "node:url"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "../src/test-runtime-environment"

test("an aliased native temp root publishes physical isolation paths that a real child can use", async () => {
  const originalEnvironment = { ...process.env }
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-temp-alias-"))
  const physicalTemp = path.join(fixture, "physical-temp")
  const aliasTemp = path.join(fixture, "alias-temp")
  await fs.mkdir(physicalTemp)
  await fs.symlink(physicalTemp, aliasTemp, process.platform === "win32" ? "junction" : "dir")
  let runtime: Awaited<ReturnType<typeof bootstrapIsolatedTestRuntime>> | undefined
  try {
    process.env.TEMP = aliasTemp
    process.env.TMP = aliasTemp
    process.env.TMPDIR = aliasTemp
    runtime = await bootstrapIsolatedTestRuntime("runner")
    expect(path.dirname(runtime.ownerRoot)).toBe(await fs.realpath(physicalTemp))
    expect(runtime.processRoot).toBe(await fs.realpath(runtime.processRoot))
    const childRoot = path.join(await fs.realpath(runtime.processRoot), "nested-runtime")
    const moduleURL = pathToFileURL(path.resolve(import.meta.dir, "../src/runtime-paths.ts")).href
    const script = `
      import { resolveOpenCorvusRuntimePaths } from ${JSON.stringify(moduleURL)};
      import fs from "node:fs/promises";
      const paths = resolveOpenCorvusRuntimePaths({ env: process.env, platform: process.platform, home: process.env.HOME });
      await fs.mkdir(paths.data, { recursive: true });
      console.log(JSON.stringify({ root: paths.root, data: (await fs.stat(paths.data)).isDirectory() }));
    `
    const child = Bun.spawn([process.execPath, "-e", script], {
      env: { ...isolatedTestChildEnvironment(runtime), OPENCORVUS_HOME: childRoot },
      stdout: "pipe", stderr: "pipe",
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    expect(exit, stderr).toBe(0)
    expect(JSON.parse(stdout)).toEqual({ root: childRoot, data: true })
  } finally {
    if (runtime) await removeIsolatedTestRuntime(runtime)
    for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key]
    Object.assign(process.env, originalEnvironment)
    if (process.platform === "win32") await fs.rmdir(aliasTemp)
    else await fs.unlink(aliasTemp)
    await fs.rm(fixture, { recursive: true, force: true })
  }
}, 30_000)

test("isolated child home exposes existing native Windows known folders", async () => {
  const originalEnvironment = { ...process.env }
  const runtime = await bootstrapIsolatedTestRuntime("runner")
  try {
    const env = isolatedTestChildEnvironment(runtime)
    const home = path.join(runtime.processRoot, "home")
    expect({ home: env.HOME, profile: env.USERPROFILE, directory: (await fs.stat(home)).isDirectory() }).toEqual({
      home,
      profile: home,
      directory: true,
    })
    if (process.platform !== "win32") return
    const local = path.join(home, "AppData", "Local")
    const roaming = path.join(home, "AppData", "Roaming")
    expect({ local: env.LOCALAPPDATA, roaming: env.APPDATA }).toEqual({ local, roaming })
    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class KnownFolderProbe {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern int SHGetFolderPathW(IntPtr hwnd, int folder, IntPtr token, uint flags, StringBuilder result);
}
'@
$localPath = New-Object System.Text.StringBuilder 260
$roamingPath = New-Object System.Text.StringBuilder 260
$localResult = [KnownFolderProbe]::SHGetFolderPathW([IntPtr]::Zero, 28, [IntPtr]::Zero, 0, $localPath)
$roamingResult = [KnownFolderProbe]::SHGetFolderPathW([IntPtr]::Zero, 26, [IntPtr]::Zero, 0, $roamingPath)
@{ localResult=$localResult; roamingResult=$roamingResult; local=$localPath.ToString(); roaming=$roamingPath.ToString() } | ConvertTo-Json -Compress
`
    const child = Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exit, stderr).toBe(0)
    expect(JSON.parse(stdout.trim())).toEqual({ localResult: 0, roamingResult: 0, local, roaming })
  } finally {
    await removeIsolatedTestRuntime(runtime)
    for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key]
    Object.assign(process.env, originalEnvironment)
  }
}, 30_000)
