import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Database as SQLite } from "bun:sqlite"
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

test("package builds project an inherited user runtime into the repository build root and retain signing environment", async () => {
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
    const expectedRoot = path.join(repoRoot, PACKAGE_RUNTIME_RELATIVE_PATH)
    const expectedTemporary = path.join(expectedRoot, "tmp")

    expect(env.OPENCORVUS_HOME).toBe(expectedRoot)
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

test("build environment preparation preserves the original database version and exact user row", async () => {
  const repoRoot = testRoot("database")
  const userRoot = path.join(repoRoot, "user-runtime")
  const dbPath = path.join(userRoot, "data", "opencorvus.db")
  try {
    await fs.mkdir(path.dirname(dbPath), { recursive: true })
    const original = new SQLite(dbPath)
    original.exec("CREATE TABLE preserved (id TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 1")
    original.query("INSERT INTO preserved VALUES (?, ?)").run("original-row", "User data 原样保留")
    original.close(true)

    const env = await preparePackageBuildEnvironment(repoRoot, { OPENCORVUS_HOME: userRoot })
    expect(env.OPENCORVUS_HOME).toBe(path.join(repoRoot, PACKAGE_RUNTIME_RELATIVE_PATH))
    const observed = new SQLite(dbPath, { readonly: true })
    try {
      expect({ version: observed.query("PRAGMA user_version").get(), rows: observed.query("SELECT * FROM preserved").all() })
        .toEqual({ version: { user_version: 1 }, rows: [{ id: "original-row", value: "User data 原样保留" }] })
    } finally {
      observed.close(true)
    }
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true })
  }
})
