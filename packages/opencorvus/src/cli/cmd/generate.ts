import { Server } from "../../server/server"
import type { CommandModule } from "yargs"

type OperationTreeNode = {
  methods: Set<string>
  children: Map<string, OperationTreeNode>
  getterNames: Map<string, string>
}

function camelCaseIdentifier(value: string): string {
  return value.replace(/_([a-zA-Z0-9])/g, (_match, character: string) => character.toUpperCase())
}

function createOperationTreeNode(): OperationTreeNode {
  return {
    methods: new Set(),
    children: new Map(),
    getterNames: new Map(),
  }
}

function operationIDs(specs: Awaited<ReturnType<typeof Server.openapi>>): string[] {
  const ids: string[] = []
  for (const item of Object.values(specs.paths)) {
    for (const method of ["get", "post", "put", "delete", "patch"] as const) {
      const operationID = item[method]?.operationId
      if (operationID) ids.push(operationID)
    }
  }
  return ids
}

function registerOperationID(root: OperationTreeNode, operationID: string): void {
  const segments = operationID.split(".").map(camelCaseIdentifier).filter(Boolean)
  if (segments.length === 0) throw new Error(`OpenAPI operationId is empty: ${operationID}`)
  let node = root
  for (const segment of segments.slice(0, -1)) {
    let child = node.children.get(segment)
    if (!child) {
      child = createOperationTreeNode()
      node.children.set(segment, child)
    }
    node = child
  }
  node.methods.add(segments[segments.length - 1])
}

function assignGetterNames(node: OperationTreeNode): void {
  const used = new Set<string>()
  for (const [childName, child] of [...node.children.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    let getterName = childName
    for (let suffix = 2; node.methods.has(getterName) || used.has(getterName); suffix += 1) {
      getterName = `${childName}${suffix}`
    }
    node.getterNames.set(childName, getterName)
    used.add(getterName)
    assignGetterNames(child)
  }
}

function buildSdkAccessorResolver(specs: Awaited<ReturnType<typeof Server.openapi>>): (operationID: string) => string {
  const root = createOperationTreeNode()
  for (const operationID of operationIDs(specs)) registerOperationID(root, operationID)
  assignGetterNames(root)
  return (operationID: string) => {
    const segments = operationID.split(".").map(camelCaseIdentifier).filter(Boolean)
    if (segments.length === 0) throw new Error(`OpenAPI operationId is empty: ${operationID}`)
    let node = root
    const accessor: string[] = []
    for (const segment of segments.slice(0, -1)) {
      const getterName = node.getterNames.get(segment)
      const child = node.children.get(segment)
      if (!getterName || !child) throw new Error(`OpenAPI operationId ${operationID} has no SDK namespace ${segment}`)
      accessor.push(getterName)
      node = child
    }
    const methodName = segments[segments.length - 1]
    if (!node.methods.has(methodName))
      throw new Error(`OpenAPI operationId ${operationID} has no SDK method ${methodName}`)
    accessor.push(methodName)
    return accessor.join(".")
  }
}

export function stableOpenApiJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableOpenApiJsonValue)
  if (!value || typeof value !== "object") return value
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = stableOpenApiJsonValue((value as Record<string, unknown>)[key])
  }
  return sorted
}

export function serializeOpenApiSpec(specs: unknown): string {
  return `${JSON.stringify(stableOpenApiJsonValue(specs), null, 2)}\n`
}

export async function generateOpenApiSpec() {
  const specs = await Server.openapi()
  const sdkOperationAccessor = buildSdkAccessorResolver(specs)
  for (const item of Object.values(specs.paths)) {
    for (const method of ["get", "post", "put", "delete", "patch"] as const) {
      const operation = item[method]
      if (!operation?.operationId) continue
      ;(operation as Record<string, unknown>)["x-codeSamples"] = [
        {
          lang: "js",
          source: [
            `import { createOpenCorvusClient } from "@opencorvus-ai/sdk"`,
            ``,
            `const client = createOpenCorvusClient()`,
            `await client.${sdkOperationAccessor(operation.operationId)}({`,
            `  ...`,
            `})`,
          ].join("\n"),
        },
      ]
    }
  }
  return specs
}

export const GenerateCommand = {
  command: "generate",
  handler: async () => {
    const specs = await generateOpenApiSpec()
    const json = serializeOpenApiSpec(specs)

    // Wait for stdout to finish writing before process.exit() is called
    await new Promise<void>((resolve, reject) => {
      process.stdout.write(json, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  },
} satisfies CommandModule
