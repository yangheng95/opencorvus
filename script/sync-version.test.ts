import { describe, expect, test } from "bun:test"

import { releaseVersionMetadata, synchronizeTauriConfig } from "./sync-version"

async function runVersionCheck(version: string) {
  const child = Bun.spawn([process.execPath, "./script/sync-version.ts", version, "--check"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

describe("release version metadata", () => {
  test("projects stable, canonical beta, and compact product versions to GitHub release metadata", () => {
    expect(releaseVersionMetadata("0.0.35")).toEqual({ version: "0.0.35", prerelease: false })
    expect(releaseVersionMetadata("v0.0.35-beta")).toEqual({ version: "0.0.35-beta", prerelease: true })
    expect(releaseVersionMetadata("v0.0.38beta")).toEqual({ version: "0.0.38-beta", prerelease: true })
    expect(() => releaseVersionMetadata("v0.0.35-beta.4")).toThrow(
      "Invalid version: v0.0.35-beta.4. Use x.y.z or x.y.z-beta (compact x.y.zbeta is also accepted).",
    )
    expect(() => releaseVersionMetadata("0.0.059-beta")).toThrow(
      "Invalid version: 0.0.059-beta. Use x.y.z or x.y.z-beta (compact x.y.zbeta is also accepted).",
    )
  })

  test("maps aligned and drifted dispatch versions to exact source-check terminal results", async () => {
    const canonical = await Bun.file(import.meta.dir + "/../packages/opencorvus/package.json").json()
    await expect(runVersionCheck(canonical.version)).resolves.toEqual({
      exitCode: 0,
      stdout: `Release-family versions aligned at ${canonical.version}\n`,
      stderr: "",
    })

    const drift = await runVersionCheck("0.0.0-beta")
    expect({
      exitCode: drift.exitCode,
      headline: drift.stderr.includes("Version drift detected. Expected 0.0.0-beta."),
      canonicalSourceNamed: drift.stderr.includes("packages/opencorvus/package.json"),
    }).toEqual({ exitCode: 1, headline: true, canonicalSourceNamed: true })
  })
})

describe("Tauri release projection", () => {
  test("projects a stable version and replaces endpoint drift with the single stable channel", () => {
    const input = JSON.stringify({
      version: "0.0.45-beta",
      plugins: {
        updater: {
          endpoints: [
            "https://github.com/yangheng95/opencorvus/releases/download/desktop-update-beta/latest.json",
            "https://example.invalid/extra.json",
          ],
        },
      },
      bundle: { windows: { wix: { version: "0.0.45.0" } } },
    })

    expect(JSON.parse(synchronizeTauriConfig(input, "0.0.46", "yangheng95/opencorvus"))).toMatchObject({
      version: "0.0.46",
      plugins: {
        updater: {
          endpoints: ["https://github.com/yangheng95/opencorvus/releases/download/desktop-update-stable/latest.json"],
        },
      },
      bundle: { windows: { wix: { version: "0.0.46" } } },
    })
  })
})
