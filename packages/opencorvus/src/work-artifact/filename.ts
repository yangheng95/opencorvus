import { classifyEntryBasename } from "@opencorvus-ai/util/entry-basename"
import z from "zod"

export function workArtifactFilename(extension: "pptx" | "docx" | "xlsx") {
  return z
    .string()
    .trim()
    .min(6)
    .max(120)
    .refine(
      (value) =>
        classifyEntryBasename(value, true) === "valid" &&
        !/^[. ]/.test(value) &&
        value.toLowerCase().endsWith(`.${extension}`),
      `filename must be a safe ${extension} basename`,
    )
}
