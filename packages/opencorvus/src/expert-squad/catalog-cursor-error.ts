import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

const data = z.object({ message: z.string() }).strict()

export const ExpertSquadCatalogCursorInvalidError = NamedError.create("ExpertSquadCatalogCursorInvalidError", data)
export const ExpertSquadCatalogRevisionConflictError = NamedError.create("ExpertSquadCatalogRevisionConflictError", data)
