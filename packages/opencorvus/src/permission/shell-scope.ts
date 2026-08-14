import { BashArity } from "@/permission/arity"
import { Filesystem } from "@/util/filesystem"
import { lazy } from "@/util/lazy"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { Language, type Node as SyntaxNode } from "web-tree-sitter"

const parser = lazy(async () => {
  const { Parser } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const assetPath = (asset: string) => {
    if (asset.startsWith("file://")) return fileURLToPath(asset)
    if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
    return fileURLToPath(new URL(asset, import.meta.url))
  }
  await Parser.init({ locateFile: () => assetPath(treeWasm) })
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  const language = await Language.load(assetPath(bashWasm))
  const result = new Parser()
  result.setLanguage(language)
  return result
})

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
    return value.slice(1, -1)
  }
  return value
}

function canonicalNode(node: SyntaxNode): unknown {
  if (node.childCount === 0) return node.isNamed ? [node.type, node.text] : node.type
  const children: unknown[] = []
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index)
    if (!child || child.type === "comment") continue
    children.push([node.fieldNameForChild(index) ?? "", canonicalNode(child)])
  }
  return [node.type, children]
}

function commandTokens(node: SyntaxNode): string[] {
  const result: string[] = []
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index)
    if (!child || !["command_name", "word", "string", "raw_string", "concatenation"].includes(child.type)) continue
    result.push(stripQuotes(child.text))
  }
  return result
}

function unwrapEnv(tokens: string[]): { executable: string; arguments: string[] } {
  if (tokens[0] !== "env") return { executable: tokens[0]!, arguments: tokens.slice(1) }
  let index = 1
  while (index < tokens.length && (tokens[index]!.startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index]!))) {
    index += 1
  }
  return index < tokens.length
    ? { executable: tokens[index]!, arguments: tokens.slice(index + 1) }
    : { executable: "env", arguments: tokens.slice(1) }
}

function endpoint(value: string): string | undefined {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}${parsed.pathname}`
  } catch {
    return undefined
  }
}

export async function canonicalShellScope(input: {
  command: string
  shell: string
  workingDirectory: string
}): Promise<Record<string, unknown>> {
  const syntax = await parser().then((value) => value.parse(input.command))
  if (!syntax) throw new Error("Permission shell scope parser returned no syntax tree")
  try {
    if (syntax.rootNode.hasError) throw new Error("Permission shell scope requires a syntactically valid command")
    const commands = syntax.rootNode.descendantsOfType("command").flatMap((node) => {
      if (!node) return []
      const tokens = commandTokens(node)
      if (tokens.length === 0) return []
      const unwrapped = unwrapEnv(tokens)
      const semantic = [unwrapped.executable, ...unwrapped.arguments]
      const understood = BashArity.prefix(semantic.filter((token) => !token.startsWith("-")).slice(0, 4))
      return [{ executable: unwrapped.executable, subcommand: understood.slice(1), argument_sha256: digest(semantic.slice(understood.length)) }]
    })
    const environment_names = syntax.rootNode
      .descendantsOfType("variable_assignment")
      .flatMap((node) => (node ? [node.text.split("=", 1)[0]!] : []))
      .sort()
    const redirects = syntax.rootNode.descendantsOfType(["file_redirect", "heredoc_redirect", "herestring_redirect"]).flatMap((node) => {
      if (!node) return []
      const target = node.namedChildren.filter((child): child is SyntaxNode => Boolean(child)).at(-1)?.text
      return [{ operator_sha256: digest(node.children.filter(Boolean).map((child) => child!.type)), target_sha256: digest(target) }]
    })
    const endpoints = syntax.rootNode
      .descendantsOfType(["word", "string", "raw_string"])
      .flatMap((node) => (node ? [endpoint(stripQuotes(node.text))].filter((value): value is string => Boolean(value)) : []))
      .sort()
    return {
      scope_type: "shell",
      shell: Filesystem.normalizePath(input.shell),
      working_directory: input.workingDirectory,
      ast_sha256: digest(canonicalNode(syntax.rootNode)),
      commands,
      environment_names,
      pipeline_count: syntax.rootNode.descendantsOfType("pipeline").length,
      redirects,
      endpoints,
    }
  } finally {
    syntax.delete()
  }
}
