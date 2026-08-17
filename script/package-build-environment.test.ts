import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { PACKAGE_RUNTIME_RELATIVE_PATH, preparePackageBuildEnvironment } from "./package-build-environment"
import { guiInstallerBuildEnvironment } from "./package-gui-installer-matrix"

function testRoot(label: string) {
  return path.resolve(".scratch", "package-build-environment-test", `${label}-${randomUUID()}`)
}

test("package builds initialize one repository-local runtime and temporary root", async () => {
  const repoRoot = testRoot("default")
  try {
    const env = await preparePackageBuildEnvironment(repoRoot, {
      LOCALAPPDATA: path.join(repoRoot, "forbidden-app-data"),
      TEMP: path.join(repoRoot, "old-temp"),
      TMP: path.join(repoRoot, "old-tmp"),
      TMPDIR: path.join(repoRoot, "old-tmpdir"),
      OPENCORVUS_VERSION: "0.0.37-beta",
    })
    const expectedRoot = path.join(repoRoot, PACKAGE_RUNTIME_RELATIVE_PATH)
    const expectedTemporary = path.join(expectedRoot, "tmp")

    expect(env.OPENCORVUS_HOME).toBe(expectedRoot)
    expect(env.TEMP).toBe(expectedTemporary)
    expect(env.TMP).toBe(expectedTemporary)
    expect(env.TMPDIR).toBe(expectedTemporary)
    expect(env.OPENCORVUS_VERSION).toBe("0.0.37-beta")
    expect((await fs.stat(expectedTemporary)).isDirectory()).toBe(true)
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true })
  }
})

test("package builds retain an explicit runtime root and signing environment", async () => {
  const repoRoot = testRoot("explicit")
  const explicitRoot = path.join(repoRoot, "operator-runtime")
  try {
    const env = await preparePackageBuildEnvironment(
      repoRoot,
      guiInstallerBuildEnvironment(
        {
          OPENCORVUS_HOME: explicitRoot,
          TAURI_SIGNING_PRIVATE_KEY: "test-private-key",
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "test-password",
        },
        "0.0.37-beta",
      ),
    )
    const expectedTemporary = path.join(explicitRoot, "tmp")

    expect(env.OPENCORVUS_HOME).toBe(explicitRoot)
    expect(env.TEMP).toBe(expectedTemporary)
    expect(env.TMP).toBe(expectedTemporary)
    expect(env.TMPDIR).toBe(expectedTemporary)
    expect(env.CI).toBe("true")
    expect(env.OPENCORVUS_VERSION).toBe("0.0.37-beta")
    expect(env.TAURI_SIGNING_PRIVATE_KEY).toBe("test-private-key")
    expect(env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe("test-password")
    expect((await fs.stat(expectedTemporary)).isDirectory()).toBe(true)
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true })
  }
})
