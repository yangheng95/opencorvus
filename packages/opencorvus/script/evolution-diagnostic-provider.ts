import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { ModelsDev } from "../src/provider/models"
import { assertCopiedOAuthAccess, CredentialRedactor } from "./real-provider-audit"

/** Credential scope and catalog completeness are different boundaries. */
export async function stageDiagnosticProvider(input: {
  authSource: string
  dataDirectory: string
  modelID: string
  redactor: CredentialRedactor
}) {
  assert.equal(path.basename(input.authSource), "auth.json")
  const authority = JSON.parse(await fs.readFile(input.authSource, "utf8"))
  input.redactor.collect(authority)
  const credential = authority.openai?.info
  assert.equal(credential?.type, "oauth", "The registered isolated authority uses existing OpenAI OAuth access")
  assertCopiedOAuthAccess(credential.expires)
  const bytes = await fs.readFile(path.join(path.dirname(input.authSource), "models.json"))
  const catalog = ModelsDev.validateExplicitCatalog(JSON.parse(bytes.toString("utf8")))
  assert(catalog.openai?.models[input.modelID], "Exact requested model must exist in the complete paired source catalog")
  await fs.writeFile(path.join(input.dataDirectory, "auth.json"), JSON.stringify({ openai: authority.openai }), { mode: 0o600 })
  await fs.writeFile(path.join(input.dataDirectory, "models.json"), bytes)
  return { providerID: "openai", modelID: input.modelID, copiedOAuthExpiresAt: credential.expires as number }
}
