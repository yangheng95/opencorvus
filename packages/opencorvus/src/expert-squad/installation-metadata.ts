import path from "node:path"
import z from "zod"
import { Filesystem } from "@/util/filesystem"
import { SQUAD_SDK_EXPERT_SQUAD_ID } from "./builtin/ids"

export const EXPERT_SQUAD_INSTALLATION_METADATA_FILE = ".opencorvus-meta.json"

const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const GenerationAuthoritySchema = z
  .object({
    generator_expert_squad_id: z.literal(SQUAD_SDK_EXPERT_SQUAD_ID),
    task_id: z.string().trim().min(1),
    session_id: z.string().trim().min(1),
    generated_at: z.iso.datetime({ offset: true }),
  })
  .strict()

export const ExpertSquadGenerationMetadataSchema = z.discriminatedUnion("method", [
  GenerationAuthoritySchema.extend({
    method: z.literal("sdk_authoring"),
  }).strict(),
  GenerationAuthoritySchema.extend({
    method: z.literal("heterogeneous_import"),
    source_digest: DigestSchema,
    mapping_digest: DigestSchema,
  }).strict(),
])

export type ExpertSquadGenerationMetadata = z.output<typeof ExpertSquadGenerationMetadataSchema>

export type ExpertSquadGenerationTrace = {
  taskID: string
  sessionID: string
}

export function expertSquadGenerationAuthority(trace: ExpertSquadGenerationTrace) {
  return GenerationAuthoritySchema.parse({
    generator_expert_squad_id: SQUAD_SDK_EXPERT_SQUAD_ID,
    task_id: trace.taskID,
    session_id: trace.sessionID,
    generated_at: new Date().toISOString(),
  })
}

export const ExpertSquadInstallationMetadataSchema = z
  .object({
    schema_version: z.literal(1),
    generation: ExpertSquadGenerationMetadataSchema,
  })
  .strict()

export type ExpertSquadInstallationMetadata = z.output<typeof ExpertSquadInstallationMetadataSchema>

function metadataPath(packageRoot: string): string {
  return path.join(packageRoot, EXPERT_SQUAD_INSTALLATION_METADATA_FILE)
}

export async function writeExpertSquadInstallationMetadata(
  packageRoot: string,
  generation: ExpertSquadGenerationMetadata,
): Promise<ExpertSquadInstallationMetadata> {
  const metadata = ExpertSquadInstallationMetadataSchema.parse({ schema_version: 1, generation })
  await Filesystem.writeAtomic(metadataPath(packageRoot), `${JSON.stringify(metadata, null, 2)}\n`)
  return metadata
}

export async function readExpertSquadInstallationMetadata(
  packageRoot: string,
): Promise<ExpertSquadInstallationMetadata | undefined> {
  const file = metadataPath(packageRoot)
  if (!(await Filesystem.exists(file))) return undefined
  let value: unknown
  try {
    value = JSON.parse(await Filesystem.readText(file))
  } catch (error) {
    throw new Error(
      `Expert Squad installation metadata is invalid JSON at ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  const parsed = ExpertSquadInstallationMetadataSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Expert Squad installation metadata does not match schema at ${file}: ${parsed.error.message}`)
  }
  return parsed.data
}
