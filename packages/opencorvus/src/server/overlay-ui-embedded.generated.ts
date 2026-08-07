export interface EmbeddedOverlayUiFile {
  path: string
  file: string
}

// UI means User Interface. The Bun build plugin virtual-loads the populated table
// during compile so this tracked source file always remains empty.
export const EMBEDDED_OVERLAY_UI: readonly EmbeddedOverlayUiFile[] = []
