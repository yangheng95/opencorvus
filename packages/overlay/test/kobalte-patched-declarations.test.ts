import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const REPO_ROOT = join(import.meta.dir, "../../..")
const PATCH_PATH = join(REPO_ROOT, "patches", "@kobalte%2Fcore@0.13.11.patch")
const KOBALTE_DIST = join(import.meta.dir, "../node_modules/@kobalte/core/dist")

function read(path: string): string {
  return readFileSync(path, "utf8")
}

function kobalteDist(): string {
  if (!existsSync(KOBALTE_DIST)) throw new Error(`Kobalte package directory is missing at ${KOBALTE_DIST}`)
  return KOBALTE_DIST
}

describe("Kobalte patched declarations", () => {
  test("root manifest and lockfile apply the Kobalte declaration patch", () => {
    const pkg = JSON.parse(read(join(REPO_ROOT, "package.json"))) as {
      patchedDependencies?: Record<string, string>
    }
    const lock = read(join(REPO_ROOT, "bun.lock"))

    expect(pkg.patchedDependencies?.["@kobalte/core@0.13.11"]).toBe("patches/@kobalte%2Fcore@0.13.11.patch")
    expect(lock).toContain('"@kobalte/core@0.13.11": "patches/@kobalte%2Fcore@0.13.11.patch"')
  })

  test("patch converts Dialog and Menubar type-only namespace exports to type aliases", () => {
    const patch = read(PATCH_PATH)

    for (const symbol of ["DialogRootProps", "DialogContentProps", "MenubarRootProps", "MenubarContextValue"]) {
      expect(patch).toContain(`+type index_${symbol} = ${symbol}`)
      expect(patch).not.toContain(`+declare const index_${symbol}: typeof ${symbol}`)
    }
  })

  test("patch preserves stylesheet pointer ownership when no blocking layer exists", () => {
    const patch = read(PATCH_PATH)
    const dist = kobalteDist()
    const expected =
      'node.style.pointerEvents = isBelowPointerBlockingLayer(node) ? "none" : hasPointerBlockingLayer() ? "auto" : "";'

    expect(patch.match(/\+\s*node\.style\.pointerEvents = isBelowPointerBlockingLayer\(node\) \? "none" : hasPointerBlockingLayer\(\) \? "auto" : "";/g)).toHaveLength(2)
    expect(read(join(dist, "chunk", "3NI6FTA2.jsx"))).toContain(expected)
    expect(read(join(dist, "chunk", "ZKYDDHM6.js"))).toContain(expected)
  })

  test("installed Kobalte declarations no longer treat Dialog and Menubar props as values", () => {
    const dist = kobalteDist()
    if (!existsSync(dist)) {
      throw new Error(`Kobalte dist directory is missing: ${dist}`)
    }
    const dialog = read(join(dist, "index-df27bfc9.d.ts"))
    const menubar = read(join(dist, "index-9e11b9e4.d.ts"))

    expect(dialog).toContain("Title: typeof DialogTitle")
    expect(dialog).toContain("Trigger: typeof DialogTrigger")
    expect(dialog).toContain("declare const index_Dialog: typeof Dialog")
    expect(dialog).not.toContain("Portal: typeof DialogPortal;\ntype index_DialogCloseButtonCommonProps")

    expect(dialog).toContain("type index_DialogRootProps = DialogRootProps")
    expect(dialog).toContain("type index_DialogContextValue = DialogContextValue")
    expect(dialog).not.toContain("declare const index_DialogRootProps: typeof DialogRootProps")

    expect(menubar).toContain("type index_MenubarRootProps = MenubarRootProps")
    expect(menubar).toContain("type index_MenubarContextValue = MenubarContextValue")
    expect(menubar).not.toContain("declare const index_MenubarRootProps: typeof MenubarRootProps")
  })

  test("TypeScript can compile Dialog and Menubar subpath imports", () => {
    const tmpRoot = join(REPO_ROOT, "packages/overlay/.codex-tmp")
    mkdirSync(tmpRoot, { recursive: true })
    const dir = mkdtempSync(join(tmpRoot, "oc-kobalte-types-"))
    const sourcePath = join(dir, "probe.tsx")
    try {
      writeFileSync(
        sourcePath,
        [
          'import { Root as DialogRoot, Content as DialogContent, Title as DialogTitle } from "@kobalte/core/dialog"',
          'import { Root as MenubarRoot, Menu as MenubarMenu, Trigger as MenubarTrigger } from "@kobalte/core/menubar"',
          "export const probe = (",
          "  <DialogRoot open={true}>",
          "    <DialogContent><DialogTitle>Dialog</DialogTitle></DialogContent>",
          "    <MenubarRoot><MenubarMenu><MenubarTrigger>Menu</MenubarTrigger></MenubarMenu></MenubarRoot>",
          "  </DialogRoot>",
          ")",
        ].join("\n"),
      )
      const program = ts.createProgram([sourcePath], {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.Preserve,
        jsxImportSource: "solid-js",
        noEmit: true,
        skipLibCheck: false,
        strict: false,
      })
      const diagnostics = ts.getPreEmitDiagnostics(program)
      expect(
        diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
      ).toBe("")
    } finally {
      rmSync(dir, { recursive: true, force: true })
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  }, 0)
})
