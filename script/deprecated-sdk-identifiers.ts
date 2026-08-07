import ts from "typescript"

// SDK means Software Development Kit. These identifiers belong to the retired OpenCode SDK surface.
export const deprecatedSdkIdentifiers = new Set([
  "OpencodeClient",
  "OpencodeClientConfig",
  "createOpencodeClient",
  "createOpencodeServer",
  "createOpencode",
])

export interface DeprecatedSdkIdentifier {
  line: number
  text: string
}

export function findDeprecatedSdkIdentifiers(source: string, fileName: string): DeprecatedSdkIdentifier[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const issues: DeprecatedSdkIdentifier[] = []
  const lines = source.split(/\r?\n/)

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && deprecatedSdkIdentifiers.has(node.text)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      issues.push({
        line: position.line + 1,
        text: lines[position.line]?.trim() ?? node.text,
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return issues
}
