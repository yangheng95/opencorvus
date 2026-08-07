import path from "node:path"
import { z } from "zod"

// POSIX means Portable Operating System Interface. ADS means Alternate Data Stream.
const FORBIDDEN_PROJECT_PATH_CHARACTERS = /[<>:"|?*\u0000-\u001f\u007f]/
const WINDOWS_RESERVED_DEVICE_SEGMENT = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i

export const PROJECT_RELATIVE_PATH_CONTRACT =
  "must be an exact canonical cross-platform forward-slash project-relative path"

export function isCanonicalProjectRelativePath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    value.includes("\\")
  ) {
    return false
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || Boolean(path.win32.parse(value).root)) {
    return false
  }
  const segments = value.split("/")
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        FORBIDDEN_PROJECT_PATH_CHARACTERS.test(segment) ||
        segment.endsWith(".") ||
        segment.endsWith(" ") ||
        WINDOWS_RESERVED_DEVICE_SEGMENT.test(segment),
    )
  ) {
    return false
  }
  return path.posix.normalize(value) === value
}

export const ProjectRelativePathSchema = z
  .string()
  .min(1)
  .refine(isCanonicalProjectRelativePath, PROJECT_RELATIVE_PATH_CONTRACT)
