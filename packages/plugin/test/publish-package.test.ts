import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  buildPublishPackageJson,
  listPackageFiles,
  packageContentDigest,
  stagePluginPackage,
  type PluginPackageJson,
} from "../script/publish-package"

const packageDirectory = path.resolve(import.meta.dir, "..")
let scratchRoot = ""

async function sourceEntryStems(directory: string, prefix = ""): Promise<string[]> {
  const stems: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      stems.push(...(await sourceEntryStems(path.join(directory, entry.name), relative)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) stems.push(relative.slice(0, -".ts".length))
  }
  return stems.sort()
}

async function linkPackageDependency(nodeModules: string, dependency: string): Promise<void> {
  const segments = dependency.split("/")
  const target = path.join(nodeModules, ...segments)
  await mkdir(path.dirname(target), { recursive: true })
  await symlink(await realpath(path.join(packageDirectory, "node_modules", ...segments)), target, "junction")
}

async function run(command: string[], cwd: string): Promise<void> {
  const process = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed (${exitCode})\n${stdout}\n${stderr}`)
}

beforeAll(async () => {
  await run([process.execPath, "run", "build"], packageDirectory)
  scratchRoot = await mkdtemp(path.join(path.dirname(packageDirectory), "plugin-publication-test-"))
})

afterAll(async () => {
  if (scratchRoot) await rm(scratchRoot, { recursive: true, force: true })
})

describe("Plugin publication package", () => {
  test("maps every normalized source export to its compiled declaration and module", () => {
    const source: PluginPackageJson = {
      name: "@opencorvus-ai/plugin-fixture",
      version: "1.0.0",
      exports: { ".": "./src/index.ts", "./nested": "./src/public/nested.ts" },
    }
    const published = buildPublishPackageJson(source)

    expect({ source: source.exports, published: published.exports }).toEqual({
      source: { ".": "./src/index.ts", "./nested": "./src/public/nested.ts" },
      published: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./nested": { types: "./dist/public/nested.d.ts", import: "./dist/public/nested.js" },
      },
    })
  })

  test("packs one exact immutable staging tree whose public exports are complete and importable", async () => {
    const sourceFixture = path.join(scratchRoot, "source-package")
    await mkdir(sourceFixture)
    await Promise.all([
      cp(path.join(packageDirectory, "src"), path.join(sourceFixture, "src"), { recursive: true }),
      cp(path.join(packageDirectory, "package.json"), path.join(sourceFixture, "package.json")),
      cp(path.join(packageDirectory, "tsconfig.json"), path.join(sourceFixture, "tsconfig.json")),
    ])
    const sourceManifest = JSON.parse(await readFile(path.join(sourceFixture, "package.json"), "utf8")) as Record<
      "dependencies" | "devDependencies",
      Record<string, string>
    >
    const fixtureDependencies = new Set([
      ...Object.keys(sourceManifest.dependencies ?? {}),
      ...Object.keys(sourceManifest.devDependencies ?? {}),
    ])
    await Promise.all(
      [...fixtureDependencies].map((dependency) =>
        linkPackageDependency(path.join(sourceFixture, "node_modules"), dependency),
      ),
    )
    await mkdir(path.join(sourceFixture, "dist"))
    await Promise.all([
      writeFile(path.join(sourceFixture, "dist", "historical-entry.js"), "throw new Error('stale output')\n"),
      writeFile(path.join(sourceFixture, "dist", "historical-entry.d.ts"), "export declare const stale: true\n"),
    ])

    const sourceManifestPath = path.join(sourceFixture, "package.json")
    const sourceManifestBefore = await readFile(sourceManifestPath)
    const stagingDirectory = path.join(scratchRoot, "staged-package")
    const staged = await stagePluginPackage({
      sourceDirectory: sourceFixture,
      stagingDirectory,
      workspaceDirectory: path.resolve(packageDirectory, "../.."),
    })
    const tarball = path.join(scratchRoot, `plugin-${randomUUID()}.tgz`)
    await run([process.execPath, "pm", "pack", "--ignore-scripts", "--filename", tarball], staged.directory)

    const tarballSha256 = createHash("sha256").update(await readFile(tarball)).digest("hex")
    const unpackedDirectory = path.join(scratchRoot, "unpacked")
    await mkdir(unpackedDirectory)
    await run(["tar", "-xf", tarball, "-C", unpackedDirectory], scratchRoot)
    const packageRoot = path.join(unpackedDirectory, "package")
    const unpackedFiles = await listPackageFiles(packageRoot)
    const unpackedManifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as PluginPackageJson
    const unpackedSha256 = await packageContentDigest(packageRoot, unpackedFiles)
    const currentSourceStems = await sourceEntryStems(path.join(sourceFixture, "src"))
    const expectedFiles = [
      ...currentSourceStems.flatMap((stem) => [`dist/${stem}.d.ts`, `dist/${stem}.js`]),
      "package.json",
    ].sort()

    expect({
      stagedFiles: staged.files,
      unpackedFiles,
      stagedSha256: staged.sha256,
      unpackedSha256,
      tarballSha256,
      sourceManifest: await readFile(sourceManifestPath),
    }).toEqual({
      stagedFiles: expectedFiles,
      unpackedFiles: expectedFiles,
      stagedSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      unpackedSha256: staged.sha256,
      tarballSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      sourceManifest: sourceManifestBefore,
    })

    const consumerDirectory = path.join(scratchRoot, "consumer")
    const consumerNodeModules = path.join(consumerDirectory, "node_modules")
    const installedPackage = path.join(consumerNodeModules, "@opencorvus-ai", "plugin")
    await mkdir(path.dirname(installedPackage), { recursive: true })
    await cp(packageRoot, installedPackage, { recursive: true })
    for (const dependency of Object.keys((unpackedManifest.dependencies ?? {}) as Record<string, string>)) {
      const segments = dependency.split("/")
      const target = path.join(consumerNodeModules, ...segments)
      await mkdir(path.dirname(target), { recursive: true })
      await symlink(await realpath(path.join(packageDirectory, "node_modules", ...segments)), target, "junction")
    }
    const publicSpecifiers = Object.keys(unpackedManifest.exports).map((subpath) =>
      subpath === "." ? unpackedManifest.name : `${unpackedManifest.name}/${subpath.slice("./".length)}`,
    )
    for (const [subpath, conditions] of Object.entries(unpackedManifest.exports)) {
      const targets = conditions as unknown as { types: string; import: string }
      expect(await readFile(path.resolve(packageRoot, targets.types), "utf8")).not.toHaveLength(0)
      const specifier =
        subpath === "." ? unpackedManifest.name : `${unpackedManifest.name}/${subpath.slice("./".length)}`
      await run([process.execPath, "-e", `await import(${JSON.stringify(specifier)})`], consumerDirectory)
    }
    const typeConsumer = publicSpecifiers.map((specifier, index) => `import type * as Public${index} from ${JSON.stringify(specifier)}`).join("\n")
    await writeFile(path.join(consumerDirectory, "index.ts"), `${typeConsumer}\n`)
    await run(
      [
        process.execPath,
        "x",
        "tsc",
        "--noEmit",
        "--module",
        "preserve",
        "--moduleResolution",
        "bundler",
        "--target",
        "es2022",
        "--skipLibCheck",
        "index.ts",
      ],
      consumerDirectory,
    )
  }, 30_000)
})
