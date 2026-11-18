import ts from "typescript"

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"])

// SDK means Software Development Kit; this extracts generated HTTP client routes from the typed SDK surface.
export function extractSdkRoutesFromText(text: string) {
  const routes = new Set<string>()
  const source = ts.createSourceFile("sdk.gen.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const options = node.arguments[0]
      if (HTTP_METHODS.has(method) && options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          const name = property.name
          if ((!ts.isIdentifier(name) && !ts.isStringLiteral(name)) || name.text !== "url") continue
          const url = property.initializer
          if (ts.isStringLiteral(url) || ts.isNoSubstitutionTemplateLiteral(url)) {
            routes.add(`${method.toUpperCase()} ${url.text}`)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return routes
}
