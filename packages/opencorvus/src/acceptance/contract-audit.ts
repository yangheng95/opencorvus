import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { auditEligibleFieldsForSymbols, type AuditEligibleField, type ContractIR } from "@/architect/contract-ir"
import type { ArchitectContractGraph } from "@/architect/contract-graph"
import { Glob } from "@/util/glob"
import type { AcceptanceSpec, ContractAuditScorer } from "./types"

export type ContractAuditStatus = "passed" | "failed" | "skipped" | "inconclusive"

export interface ContractAuditGoal {
  id: string
  kind?: string
  owned_paths: string[]
}

export interface ContractAuditCriteriaResult {
  name: string
  label: string
  family: "contract_audit"
  status: ContractAuditStatus
  evidence: string
  goal_id?: string
}

interface Finding {
  file: string
  line: number
  contractName: string
  fieldName: string
  literal: string
  expectedValues: string[]
}

interface InconclusiveFinding {
  file: string
  line: number
  contractName: string
  fieldName: string
  identifierName: string
  reason: string
}

interface LiteralValue {
  value: string
  node: ts.Node
}

export function contractAuditCriteriaName(spec: AcceptanceSpec, scorer: ContractAuditScorer): string {
  return `acceptance:${spec.id}:${scorer.name}`
}

export function contractAuditRequired(spec: AcceptanceSpec, _scorer: ContractAuditScorer): boolean {
  return spec.severity === "essential"
}

export function runContractAudit(input: {
  workDir: string
  index: Map<string, ContractIR>
  graph?: ArchitectContractGraph
  goal: ContractAuditGoal
  spec: AcceptanceSpec
  scorer: ContractAuditScorer
}): ContractAuditCriteriaResult {
  const requestedSymbols = input.scorer.spec.contract_ids
  const artifactAudit = auditGraphContractArtifactPaths({
    workDir: input.workDir,
    graph: input.graph,
    contractIDs: requestedSymbols,
  })
  if (artifactAudit?.status === "failed") {
    return {
      name: contractAuditCriteriaName(input.spec, input.scorer),
      label: `${input.spec.title} / ${input.scorer.name}`,
      family: "contract_audit",
      status: "failed",
      evidence: artifactAudit.evidence,
    }
  }

  const fields = auditEligibleFieldsForSymbols({
    index: input.index,
    symbols: requestedSymbols,
  })
  if (fields.length === 0) {
    if (artifactAudit?.status === "passed") {
      return {
        name: contractAuditCriteriaName(input.spec, input.scorer),
        label: `${input.spec.title} / ${input.scorer.name}`,
        family: "contract_audit",
        status: "passed",
        evidence: artifactAudit.evidence,
      }
    }
    return {
      name: contractAuditCriteriaName(input.spec, input.scorer),
      label: `${input.spec.title} / ${input.scorer.name}`,
      family: "contract_audit",
      status: "skipped",
      evidence: `goal=${input.goal.id}; contract_ids=${requestedSymbols.join(",")}; no literal_union/ref-resolved/branded-resolved fields to audit`,
    }
  }

  const files = collectSourceFiles(input.workDir, input.goal.owned_paths)
  if (files.length === 0) {
    return {
      name: contractAuditCriteriaName(input.spec, input.scorer),
      label: `${input.spec.title} / ${input.scorer.name}`,
      family: "contract_audit",
      status: "skipped",
      evidence: `goal=${input.goal.id}; no TypeScript source files found in owned_paths=${input.goal.owned_paths.join(",")}`,
    }
  }

  const fieldsByContract = groupAuditFieldsByContract(fields)
  const program = createAuditProgram(files)
  const checker = program.getTypeChecker()
  const sourceFiles = new Map(files.map((file) => [path.normalize(file), file]))
  const findings: Finding[] = []
  const inconclusiveFindings = new Map<string, InconclusiveFinding>()
  let observedAssignments = 0
  for (const sourceFile of program.getSourceFiles()) {
    const originalFile = sourceFiles.get(path.normalize(sourceFile.fileName))
    if (!originalFile) continue
    const relativeFile = path.relative(input.workDir, originalFile).replaceAll("\\", "/")
    visitOwnerBoundAssignments(sourceFile, checker, fieldsByContract, {
      onAssignment(contractName, field, literal, node) {
        observedAssignments++
        if (field.expectedValues.includes(literal)) return
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        findings.push({
          file: relativeFile,
          line: position.line + 1,
          contractName,
          fieldName: field.fieldName,
          literal,
          expectedValues: field.expectedValues,
        })
      },
      onInconclusive(contractName, field, node, identifierName, reason) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const finding: InconclusiveFinding = {
          file: relativeFile,
          line: position.line + 1,
          contractName,
          fieldName: field.fieldName,
          identifierName,
          reason,
        }
        inconclusiveFindings.set(
          `${finding.file}:${finding.line}:${finding.contractName}.${finding.fieldName}:${finding.identifierName}:${finding.reason}`,
          finding,
        )
      },
    })
  }

  if (findings.length > 0) {
    return {
      name: contractAuditCriteriaName(input.spec, input.scorer),
      label: `${input.spec.title} / ${input.scorer.name}`,
      family: "contract_audit",
      status: "failed",
      evidence: findings
        .map(
          (finding) =>
            `${finding.file}:${finding.line} field=${finding.contractName}.${finding.fieldName} literal=${JSON.stringify(finding.literal)} expected=${finding.expectedValues.map((value) => JSON.stringify(value)).join("|")}`,
        )
        .join("\n"),
    }
  }

  if (observedAssignments === 0) {
    if (inconclusiveFindings.size > 0) {
      return {
        name: contractAuditCriteriaName(input.spec, input.scorer),
        label: `${input.spec.title} / ${input.scorer.name}`,
        family: "contract_audit",
        status: "inconclusive",
        evidence: inconclusiveEvidence({
          goalID: input.goal.id,
          fields,
          findings: [...inconclusiveFindings.values()],
        }),
      }
    }
    return {
      name: contractAuditCriteriaName(input.spec, input.scorer),
      label: `${input.spec.title} / ${input.scorer.name}`,
      family: "contract_audit",
      status: "inconclusive",
      evidence: inconclusiveEvidence({
        goalID: input.goal.id,
        fields,
        findings: [],
        note: "no owner-bound assignments observed; audit cannot prove contract compliance",
      }),
    }
  }

  return {
    name: contractAuditCriteriaName(input.spec, input.scorer),
    label: `${input.spec.title} / ${input.scorer.name}`,
    family: "contract_audit",
    status: "passed",
    evidence: passEvidence({
      goalID: input.goal.id,
      fields,
      observedAssignments,
      inconclusiveFindings: [...inconclusiveFindings.values()],
      note: artifactAudit?.status === "passed" ? artifactAudit.evidence : undefined,
    }),
  }
}

interface ArtifactPathFinding {
  contractID: string
  artifactPath: string
  reason: string
}

interface MaterializedArtifactPath {
  contractID: string
  artifactPath: string
  matches: string[]
}

function auditGraphContractArtifactPaths(input: {
  workDir: string
  graph?: ArchitectContractGraph
  contractIDs: readonly string[]
}): { status: "passed" | "failed"; evidence: string } | undefined {
  if (!input.graph) return undefined
  const requested = new Set(input.contractIDs)
  const contracts = input.graph.contracts.filter(
    (contract) => requested.has(contract.id) && contract.artifact_paths.length > 0,
  )
  if (contracts.length === 0) return undefined

  const missing: ArtifactPathFinding[] = []
  const materialized: MaterializedArtifactPath[] = []
  for (const contract of contracts) {
    for (const artifactPath of contract.artifact_paths) {
      const resolved = materializedArtifactPathMatches(input.workDir, artifactPath)
      if (resolved.status === "matched") {
        materialized.push({ contractID: contract.id, artifactPath: resolved.artifactPath, matches: resolved.matches })
        continue
      }
      missing.push({ contractID: contract.id, artifactPath: resolved.artifactPath, reason: resolved.reason })
    }
  }

  if (missing.length > 0) {
    return {
      status: "failed",
      evidence: [
        `goal contract artifact materialization failed; contract_ids=${contracts.map((contract) => contract.id).join(",")}`,
        ...missing.map(
          (finding) =>
            `- contract=${finding.contractID} artifact_path=${JSON.stringify(finding.artifactPath)} reason=${finding.reason}`,
        ),
      ].join("\n"),
    }
  }

  return {
    status: "passed",
    evidence: [
      `materialized_contract_artifact_paths=${materialized.length}`,
      ...materialized.map(
        (entry) =>
          `- contract=${entry.contractID} artifact_path=${JSON.stringify(entry.artifactPath)} matches=${entry.matches
            .slice(0, 5)
            .map((match) => JSON.stringify(match))
            .join("|")}`,
      ),
    ].join("\n"),
  }
}

function materializedArtifactPathMatches(
  workDir: string,
  rawArtifactPath: string,
):
  | { status: "matched"; artifactPath: string; matches: string[] }
  | { status: "missing"; artifactPath: string; reason: string } {
  const artifactPath = normalizeContractArtifactPath(rawArtifactPath)
  if (!artifactPath) return { status: "missing", artifactPath: rawArtifactPath, reason: "empty artifact path" }
  if (path.isAbsolute(artifactPath)) {
    return { status: "missing", artifactPath, reason: "artifact path must be relative to the build workDir" }
  }
  if (artifactPath === ".." || artifactPath.startsWith("../")) {
    return { status: "missing", artifactPath, reason: "artifact path escapes the build workDir" }
  }

  if (!isGlobArtifactPath(artifactPath)) {
    const absolute = path.resolve(workDir, artifactPath)
    if (!pathInside(workDir, absolute)) {
      return { status: "missing", artifactPath, reason: "artifact path escapes the build workDir" }
    }
    return fs.existsSync(absolute)
      ? { status: "matched", artifactPath, matches: [artifactPath] }
      : { status: "missing", artifactPath, reason: "path does not exist" }
  }

  const matches = Glob.scanSync(artifactPath, { cwd: workDir, dot: true, include: "all" })
    .map((match) => normalizeContractArtifactPath(String(match)))
    .filter((match) => !!match && !match.startsWith("../"))
    .sort()
  if (matches.length > 0) return { status: "matched", artifactPath, matches }

  const subtreeRoot = globSubtreeRoot(artifactPath)
  if (subtreeRoot) {
    const absolute = path.resolve(workDir, subtreeRoot)
    if (pathInside(workDir, absolute) && fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      return { status: "matched", artifactPath, matches: [subtreeRoot] }
    }
  }

  return { status: "missing", artifactPath, reason: "glob matched no files or directories" }
}

function normalizeContractArtifactPath(artifactPath: string): string {
  let normalized = artifactPath.trim().replaceAll("\\", "/")
  while (normalized.startsWith("./")) normalized = normalized.slice(2)
  return normalized.replace(/\/+$/, "")
}

function isGlobArtifactPath(artifactPath: string): boolean {
  return /[*?[\]{}()!+@]/.test(artifactPath)
}

function globSubtreeRoot(artifactPath: string): string | undefined {
  if (!artifactPath.endsWith("/**")) return undefined
  const root = artifactPath.slice(0, -3)
  return root.length > 0 && !isGlobArtifactPath(root) ? root : undefined
}

function pathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function passEvidence(input: {
  goalID: string
  fields: AuditEligibleField[]
  observedAssignments: number
  inconclusiveFindings?: InconclusiveFinding[]
  note?: string
}): string {
  const inconclusiveFields = [...new Set((input.inconclusiveFindings ?? []).map((finding) => finding.fieldName))].sort()
  const parts = [
    `goal=${input.goalID}`,
    `fields=${input.fields.map((field) => `${field.contractName}.${field.fieldName}`).join(",")}`,
    `observed_assignments=${input.observedAssignments}`,
    "all compliant",
    `static_inference_inconclusive_for=${inconclusiveFields.length > 0 ? inconclusiveFields.join(",") : "none"}`,
  ]
  if (input.note) parts.push(input.note)
  return parts.join("; ")
}

function inconclusiveEvidence(input: {
  goalID: string
  fields: AuditEligibleField[]
  findings: InconclusiveFinding[]
  note?: string
}): string {
  const lines = [
    `goal=${input.goalID}`,
    `audited_fields=${input.fields.map((field) => `${field.contractName}.${field.fieldName}`).join(",")}`,
    "unable_to_statically_audit:",
    ...input.findings.map(
      (finding) =>
        `- field=${finding.fieldName} at ${finding.file}:${finding.line}: Identifier '${finding.identifierName}' ${finding.reason}`,
    ),
    "suggestion:",
    "- inline literal values into the PropertyAssignment to enable static audit, for example { field: 'AllowedValue' }",
    "- remove this contract_audit scorer if static audit is not required for this contract boundary",
    "- add an llm_judge scorer alongside this audit for Tier 2 semantic review",
  ]
  if (input.note) lines.splice(3, 0, input.note)
  return lines.join("\n")
}

function collectSourceFiles(workDir: string, ownedPaths: readonly string[]): string[] {
  const files: string[] = []
  for (const ownedPath of ownedPaths) {
    const absolute = path.resolve(workDir, ownedPath)
    if (!fs.existsSync(absolute)) continue
    const stat = fs.statSync(absolute)
    if (stat.isFile() && isSourceFile(absolute)) {
      files.push(absolute)
      continue
    }
    if (stat.isDirectory()) {
      collectSourceFilesFromDirectory(absolute, files)
    }
  }
  return [...new Set(files)]
}

function collectSourceFilesFromDirectory(directory: string, files: string[]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".opencorvus") continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collectSourceFilesFromDirectory(absolute, files)
      continue
    }
    if (entry.isFile() && isSourceFile(absolute)) files.push(absolute)
  }
}

function isSourceFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(file)
}

function createAuditProgram(files: readonly string[]): ts.Program {
  return ts.createProgram([...files], {
    allowJs: true,
    allowSyntheticDefaultImports: true,
    checkJs: false,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  })
}

function groupAuditFieldsByContract(
  fields: readonly AuditEligibleField[],
): Map<string, Map<string, AuditEligibleField>> {
  const grouped = new Map<string, Map<string, AuditEligibleField>>()
  for (const field of fields) {
    const contractFields = grouped.get(field.contractName) ?? new Map<string, AuditEligibleField>()
    contractFields.set(field.fieldName, field)
    grouped.set(field.contractName, contractFields)
  }
  return grouped
}

function visitOwnerBoundAssignments(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  fieldsByContract: Map<string, Map<string, AuditEligibleField>>,
  sink: {
    onAssignment: (contractName: string, field: AuditEligibleField, literal: string, node: ts.Node) => void
    onInconclusive: (
      contractName: string,
      field: AuditEligibleField,
      node: ts.Node,
      identifierName: string,
      reason: string,
    ) => void
  },
) {
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const contractName of contractsForObjectLiteral(node, checker, fieldsByContract)) {
        auditObjectLiteral(node, contractName, fieldsByContract.get(contractName)!, checker, sink)
      }
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const contractName of contractsForJsxElement(node, checker, fieldsByContract)) {
        auditJsxAttributes(node.attributes, contractName, fieldsByContract.get(contractName)!, checker, sink)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

function contractsForObjectLiteral(
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker,
  fieldsByContract: Map<string, Map<string, AuditEligibleField>>,
): string[] {
  const ownerType =
    checker.getContextualType(node) ?? contextualTypeFromSatisfies(node, checker) ?? checker.getTypeAtLocation(node)
  return contractNamesForType(ownerType, checker, fieldsByContract)
}

function contextualTypeFromSatisfies(node: ts.ObjectLiteralExpression, checker: ts.TypeChecker): ts.Type | undefined {
  if (!ts.isSatisfiesExpression(node.parent)) return undefined
  return checker.getTypeFromTypeNode(node.parent.type)
}

function contractsForJsxElement(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  checker: ts.TypeChecker,
  fieldsByContract: Map<string, Map<string, AuditEligibleField>>,
): string[] {
  const tagType = checker.getTypeAtLocation(node.tagName)
  const signatures = checker.getSignaturesOfType(tagType, ts.SignatureKind.Call)
  const propsTypes = signatures
    .map((signature) => signature.getParameters()[0])
    .filter((symbol): symbol is ts.Symbol => Boolean(symbol))
    .map((symbol) => checker.getTypeOfSymbolAtLocation(symbol, node.tagName))
  return [...new Set(propsTypes.flatMap((type) => contractNamesForType(type, checker, fieldsByContract)))]
}

function contractNamesForType(
  type: ts.Type | undefined,
  checker: ts.TypeChecker,
  fieldsByContract: Map<string, Map<string, AuditEligibleField>>,
): string[] {
  if (!type) return []
  const names: string[] = []
  for (const contractName of fieldsByContract.keys()) {
    if (typeReferencesContract(type, contractName, checker, new Set())) names.push(contractName)
  }
  return names
}

function typeReferencesContract(
  type: ts.Type,
  contractName: string,
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): boolean {
  if (seen.has(type)) return false
  seen.add(type)
  if (type.aliasSymbol?.getName() === contractName) return true
  if (type.getSymbol()?.getName() === contractName) return true
  const apparent = checker.getApparentType(type)
  if (apparent !== type && typeReferencesContract(apparent, contractName, checker, seen)) return true
  if (type.isUnionOrIntersection()) {
    return type.types.some((part) => typeReferencesContract(part, contractName, checker, seen))
  }
  const baseTypes = type.isClassOrInterface() ? (type.getBaseTypes() ?? []) : []
  if (baseTypes.some((base) => typeReferencesContract(base, contractName, checker, seen))) return true
  const rendered = checker.typeToString(type, undefined, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)
  return rendered === contractName || rendered.startsWith(`${contractName}<`)
}

function auditObjectLiteral(
  node: ts.ObjectLiteralExpression,
  contractName: string,
  fields: Map<string, AuditEligibleField>,
  checker: ts.TypeChecker,
  sink: {
    onAssignment: (contractName: string, field: AuditEligibleField, literal: string, node: ts.Node) => void
    onInconclusive: (
      contractName: string,
      field: AuditEligibleField,
      node: ts.Node,
      identifierName: string,
      reason: string,
    ) => void
  },
) {
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      const fieldName = propertyNameText(property.name)
      if (!fieldName) continue
      const field = fields.get(fieldName)
      if (!field) continue
      auditExpression(property.initializer, contractName, field, checker, sink)
    } else if (ts.isShorthandPropertyAssignment(property)) {
      const field = fields.get(property.name.text)
      if (!field) continue
      auditExpression(property.name, contractName, field, checker, sink)
    }
  }
}

function auditJsxAttributes(
  attributes: ts.JsxAttributes,
  contractName: string,
  fields: Map<string, AuditEligibleField>,
  checker: ts.TypeChecker,
  sink: {
    onAssignment: (contractName: string, field: AuditEligibleField, literal: string, node: ts.Node) => void
    onInconclusive: (
      contractName: string,
      field: AuditEligibleField,
      node: ts.Node,
      identifierName: string,
      reason: string,
    ) => void
  },
) {
  for (const property of attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue
    if (!ts.isIdentifier(property.name)) continue
    const field = fields.get(property.name.text)
    if (!field || !property.initializer) continue
    if (ts.isStringLiteral(property.initializer)) {
      sink.onAssignment(contractName, field, property.initializer.text, property.initializer)
      continue
    }
    if (ts.isJsxExpression(property.initializer) && property.initializer.expression) {
      auditExpression(property.initializer.expression, contractName, field, checker, sink)
    }
  }
}

function auditExpression(
  expression: ts.Expression,
  contractName: string,
  field: AuditEligibleField,
  checker: ts.TypeChecker,
  sink: {
    onAssignment: (contractName: string, field: AuditEligibleField, literal: string, node: ts.Node) => void
    onInconclusive: (
      contractName: string,
      field: AuditEligibleField,
      node: ts.Node,
      identifierName: string,
      reason: string,
    ) => void
  },
) {
  const values = resolveExpressionStrings(expression, checker, new Set())
  if (values === "inconclusive") {
    sink.onInconclusive(
      contractName,
      field,
      expression,
      closestIdentifierName(expression),
      "cannot be reduced to deterministic string literal values after owner binding",
    )
    return
  }
  for (const value of values) sink.onAssignment(contractName, field, value.value, value.node)
}

function resolveExpressionStrings(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  resolving: Set<ts.Symbol>,
): LiteralValue[] | "inconclusive" {
  const unwrapped = unwrapExpression(expression)
  if (ts.isStringLiteralLike(unwrapped)) return [{ value: unwrapped.text, node: unwrapped }]
  if (ts.isConditionalExpression(unwrapped)) {
    const whenTrue = resolveExpressionStrings(unwrapped.whenTrue, checker, resolving)
    const whenFalse = resolveExpressionStrings(unwrapped.whenFalse, checker, resolving)
    if (whenTrue === "inconclusive" || whenFalse === "inconclusive") return "inconclusive"
    return [...whenTrue, ...whenFalse]
  }
  if (ts.isBinaryExpression(unwrapped) && unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveExpressionStrings(unwrapped.left, checker, resolving)
    const right = resolveExpressionStrings(unwrapped.right, checker, resolving)
    if (left === "inconclusive" || right === "inconclusive") return "inconclusive"
    return left.flatMap((leftValue) =>
      right.map((rightValue) => ({
        value: `${leftValue.value}${rightValue.value}`,
        node: unwrapped,
      })),
    )
  }
  if (ts.isIdentifier(unwrapped)) return resolveIdentifierStrings(unwrapped, checker, resolving)
  return "inconclusive"
}

function resolveIdentifierStrings(
  identifier: ts.Identifier,
  checker: ts.TypeChecker,
  resolving: Set<ts.Symbol>,
): LiteralValue[] | "inconclusive" {
  const symbol = ts.isShorthandPropertyAssignment(identifier.parent)
    ? checker.getShorthandAssignmentValueSymbol(identifier.parent)
    : checker.getSymbolAtLocation(identifier)
  if (!symbol || resolving.has(symbol)) return "inconclusive"
  resolving.add(symbol)
  for (const declaration of symbol.getDeclarations() ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      if (!isReadonlyBinding(declaration)) continue
      if (declaration.name.getStart() >= identifier.getStart()) continue
      const values = resolveExpressionStrings(declaration.initializer, checker, resolving)
      resolving.delete(symbol)
      return values
    }
    if (ts.isParameter(declaration) && declaration.initializer) {
      if (declaration.name.getStart() >= identifier.getStart()) continue
      const values = resolveExpressionStrings(declaration.initializer, checker, resolving)
      resolving.delete(symbol)
      return values
    }
  }
  const assigned = resolveSinglePriorAssignment(symbol, identifier, checker, resolving)
  if (assigned) {
    resolving.delete(symbol)
    return assigned
  }
  resolving.delete(symbol)
  return "inconclusive"
}

function resolveSinglePriorAssignment(
  symbol: ts.Symbol,
  identifier: ts.Identifier,
  checker: ts.TypeChecker,
  resolving: Set<ts.Symbol>,
): LiteralValue[] | "inconclusive" | undefined {
  const sourceFile = identifier.getSourceFile()
  const usePosition = identifier.getStart(sourceFile)
  const assignments: ts.Expression[] = []
  const visit = (node: ts.Node) => {
    if (node.getStart(sourceFile) >= usePosition) return
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      checker.getSymbolAtLocation(node.left) === symbol
    ) {
      assignments.push(node.right)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (assignments.length === 0) return undefined
  if (assignments.length > 1) return "inconclusive"
  return resolveExpressionStrings(assignments[0]!, checker, resolving)
}

function isReadonlyBinding(declaration: ts.VariableDeclaration): boolean {
  const list = declaration.parent
  if (!ts.isVariableDeclarationList(list)) return false
  return (ts.getCombinedNodeFlags(list) & ts.NodeFlags.Const) !== 0
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function closestIdentifierName(node: ts.Node): string {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return node.expression.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  let found: string | undefined
  const visit = (child: ts.Node) => {
    if (found) return
    if (ts.isIdentifier(child)) {
      found = child.text
      return
    }
    ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return found ?? "<expression>"
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text
  return undefined
}
