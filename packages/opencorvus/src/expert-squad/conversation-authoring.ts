import {
  analyzeExpertSquadWorkflowTopology,
  validateExpertSquadPackageDefinition,
  writeExpertSquadPackage,
} from "@opencorvus-ai/sdk/expert-squad-authoring"
import { rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Global } from "../global"
import { ExpertSquadPackageManager } from "./manager"
import { ExpertSquadRegistry } from "./registry"
import type { ExpertSquadPackageLocations } from "./locations"
import type { ExpertSquadGenerationMetadata } from "./installation-metadata"

export namespace ExpertSquadConversationAuthoring {
  export interface Input {
    projectDirectory: string
    definition: unknown
    installationScope: ExpertSquadPackageLocations.InstallationScope
    generation?: ExpertSquadGenerationMetadata
    expectedCurrentPackageDigest?: string
  }

  export async function author(input: Input) {
    const definition = validateExpertSquadPackageDefinition(input.definition)
    const temporaryRoot = await Global.createTemporaryDirectory("expert-squad-authoring-")
    const sourceDirectory = path.join(temporaryRoot, "source")
    try {
      const written = await writeExpertSquadPackage({ directory: sourceDirectory, definition })
      const validated = await ExpertSquadPackageManager.validateDirectory({
        projectDirectory: input.projectDirectory,
        sourceDirectory,
      })
      const imported = await ExpertSquadPackageManager.importDirectory({
        projectDirectory: input.projectDirectory,
        sourceDirectory,
        installationScope: input.installationScope,
        ...(input.generation ? { generation: input.generation } : {}),
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      })
      const packageDigest = await ExpertSquadRegistry.packageDigest(imported.after.targetRoot)
      return {
        namespace: validated.namespace,
        id: validated.id,
        label: validated.label,
        version: validated.version,
        packageDigest,
        installationScope: input.installationScope,
        agents: Object.entries(validated.capability_projection.agents).map(([id, agent]) => ({
          id,
          label: agent.label,
          baseRole: agent.base_role,
        })),
        workflowTopology: analyzeExpertSquadWorkflowTopology(validated),
        fileCount: written.files.length,
        targetRoot: imported.after.targetRoot,
        replaced: imported.operation === "replaced",
        mutationOperation: imported.operation,
        ...(input.generation ? { generation: input.generation } : {}),
      }
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }
}
