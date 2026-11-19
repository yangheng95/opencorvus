import { parse } from "content-type"

/** The case-insensitive media type, independent of representation parameters. */
export function baseMediaType(mime: string): string {
  return parse(mime, { parameters: false }).type
}

/** Classify the declared non-text model modality without guessing from filenames. */
export function mediaInputModality(mime: string): "image" | "audio" | "video" | "pdf" | undefined {
  const type = baseMediaType(mime)
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("audio/")) return "audio"
  if (type.startsWith("video/")) return "video"
  if (type === "application/pdf") return "pdf"
}
