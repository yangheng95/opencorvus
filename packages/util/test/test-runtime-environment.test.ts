import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "../src/test-runtime-environment"

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
