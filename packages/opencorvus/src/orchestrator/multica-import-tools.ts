import { MulticaExpertSquadImport, MulticaOpenCorvusMappingSchema } from "@/expert-squad/multica-import"
import { Instance } from "@/project/instance"
import { tool } from "ai"
import z from "zod"
import type { ExpertSquadGenerationTrace } from "@/expert-squad/installation-metadata"

type MulticaImportToolBackend = Pick<typeof MulticaExpertSquadImport, "catalog" | "preview" | "importSquad">

const SquadIdentity = z.string().uuid().describe("Exact Multica squad universally unique identifier.")
const SourceDigest = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .describe("Exact SHA-256 source digest returned by multica_preview.")

function output(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function createMulticaImportTools(
  generationTrace: ExpertSquadGenerationTrace,
  backend: MulticaImportToolBackend = MulticaExpertSquadImport,
) {
  return {
    multica_catalog: tool({
      description: [
        "List every Multica squad from the official local Multica configuration with authoritative installed status.",
        "Use this before selecting a squad. Choose only installed=false entries; each entry contains the complete official member roster needed for explicit mapping.",
        "It reads the remote source without writing project state and never returns credentials.",
      ].join("\n"),
      inputSchema: z.object({}).strict(),
      async execute() {
        const squads = (await backend.catalog({ projectDirectory: Instance.project.worktree })).map((squad) => ({
          id: squad.id,
          name: squad.name,
          description: squad.description,
          installed: squad.installed,
          member_count: squad.member_count,
          archived_at: squad.archived_at,
          updated_at: squad.updated_at,
          members: squad.members,
        }))
        return output({ squads })
      },
    }),
    multica_preview: tool({
      description: [
        "Fetch and validate one complete Multica squad graph without writing project state.",
        "Returns the canonical target identity, immutable source digest, exact members, complete skills, discovered remote MCP capabilities, typed local MCP repair candidates, accepted replacements, exact omissions, semantic blockers, and non-portable evidence.",
        "A non-empty blockers array means multica_import must not be called for that snapshot.",
      ].join("\n"),
      inputSchema: z
        .object({
          squad_id: SquadIdentity,
          mapping: MulticaOpenCorvusMappingSchema.describe(
            "Smallest-sufficient OpenCorvus mapping: an explicit runtime template for every source Agent, a possibly-empty Task-level virtual-workflow record whose nodes each execute once per Task, evidence-backed local MCP replacements, and exact reasoned MCP omissions.",
          ),
        })
        .strict(),
      async execute(params) {
        return output(
          await backend.preview({
            projectDirectory: Instance.project.worktree,
            squadID: params.squad_id,
            mapping: params.mapping,
          }),
        )
      },
    }),
    multica_import: tool({
      description: [
        "Import one previously previewed, blocker-free Multica squad into the current project's .opencorvus expert-squad catalog.",
        "The current Instance supplies project context and the Host records exact Task and Session generation provenance; installation uses the generic project scope and accepts no target path.",
        "The source, remote MCP capability inventory, and accepted replacement target tool refs are resolved again and must match source_digest exactly. An already installed canonical package is never replaced.",
        "The imported package remains inactive.",
      ].join("\n"),
      inputSchema: z
        .object({
          squad_id: SquadIdentity,
          source_digest: SourceDigest,
          mapping_digest: SourceDigest.describe("Exact SHA-256 mapping digest returned by multica_preview."),
          mapping: MulticaOpenCorvusMappingSchema.describe(
            "The exact explicit OpenCorvus mapping used by the latest blocker-free multica_preview, including Agent runtime mappings, accepted MCP replacements, and exact MCP omissions.",
          ),
        })
        .strict(),
      async execute(params) {
        return output(
          await backend.importSquad({
            projectDirectory: Instance.project.worktree,
            squadID: params.squad_id,
            sourceDigest: params.source_digest,
            mappingDigest: params.mapping_digest,
            mapping: params.mapping,
            generationTrace,
          }),
        )
      },
    }),
  } as const
}
