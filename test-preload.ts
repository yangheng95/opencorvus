await import("./packages/opencorvus/test/preload")

// Vite-injected globals must exist before any src module loads, because
// `utils/version.ts` reads `__OPENCORVUS_OVERLAY_VERSION__` at top level
// and is reached transitively by `services/dialog` → `services/app-dialog`
// → many src modules. Without this preload, tests that import event
// routing or any UI service crash with "ReferenceError" during module
// evaluation. Vite's define plugin handles this at build time; tests
// don't run Vite, so the preload supplies the same constant.
;(globalThis as typeof globalThis & { __OPENCORVUS_OVERLAY_VERSION__?: string }).__OPENCORVUS_OVERLAY_VERSION__ = "test"

export {}
