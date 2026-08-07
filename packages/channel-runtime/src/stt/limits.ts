export const DEFAULT_STT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

export function assertSTTAudioSize(sizeBytes: number, maxFileSizeBytes = DEFAULT_STT_MAX_FILE_SIZE_BYTES): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error(`[STT] Audio size must be a non-negative finite number, got ${sizeBytes}`)
  }
  if (!Number.isFinite(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error(`[STT] Max audio size must be a positive finite number, got ${maxFileSizeBytes}`)
  }
  if (sizeBytes > maxFileSizeBytes) {
    throw new Error(
      `[STT] Audio too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB > ${(maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB limit)`,
    )
  }
}
