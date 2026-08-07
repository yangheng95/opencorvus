import z from "zod"
import { Tool } from "./tool"
import path from "path"
import { LSP } from "../lsp"
import DESCRIPTION from "./lsp.txt"
import { Instance } from "../project/instance"
import { pathToFileURL } from "url"
import { assertExternalDirectory } from "./external-directory"
import { Filesystem } from "../util/filesystem"
import { executionProcessAuthority } from "./execution-files"

const operations = [
  "goToDefinition",
  "findReferences",
  "hover",
  "documentSymbol",
  "workspaceSymbol",
  "goToImplementation",
  "prepareCallHierarchy",
  "incomingCalls",
  "outgoingCalls",
] as const

export const LspTool = Tool.define("lsp", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(operations).describe("The LSP operation to perform"),
    filePath: z.string().describe("The absolute or relative path to the file"),
    line: z.number().int().min(1).describe("The line number (1-based, as shown in editors)"),
    character: z.number().int().min(1).describe("The character offset (1-based, as shown in editors)"),
  }),
  execute: async (args, ctx) => {
    const file = path.isAbsolute(args.filePath) ? args.filePath : path.join(Instance.directory, args.filePath)
    await assertExternalDirectory(ctx, file)

    await ctx.ask({
      permission: "lsp",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })
    const uri = pathToFileURL(file).href
    const position = {
      file,
      line: args.line - 1,
      character: args.character - 1,
    }
    const processAuthority = executionProcessAuthority(ctx)

    const relPath = path.relative(Instance.worktree, file)
    const title = `${args.operation} ${relPath}:${args.line}:${args.character}`

    const exists = await Filesystem.exists(file)
    if (!exists) {
      throw new Error(`File not found: ${file}`)
    }

    const available = await LSP.hasClients(file, processAuthority)
    if (!available) {
      throw new Error("No LSP server available for this file type.")
    }

    await LSP.touchFile(file, true, processAuthority)

    const result: unknown[] = await (async () => {
      switch (args.operation) {
        case "goToDefinition":
          return LSP.definition(position, processAuthority)
        case "findReferences":
          return LSP.references(position, processAuthority)
        case "hover":
          return LSP.hover(position, processAuthority)
        case "documentSymbol":
          return LSP.documentSymbol(uri, processAuthority)
        case "workspaceSymbol":
          return LSP.workspaceSymbol("", processAuthority)
        case "goToImplementation":
          return LSP.implementation(position, processAuthority)
        case "prepareCallHierarchy":
          return LSP.prepareCallHierarchy(position, processAuthority)
        case "incomingCalls":
          return LSP.incomingCalls(position, processAuthority)
        case "outgoingCalls":
          return LSP.outgoingCalls(position, processAuthority)
      }
    })()

    const output = (() => {
      if (result.length === 0) return `No results found for ${args.operation}`
      return JSON.stringify(result, null, 2)
    })()

    return {
      title,
      metadata: { result },
      output,
    }
  },
})
