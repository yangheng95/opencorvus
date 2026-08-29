import { defaultClientConditions, defineConfig, type Plugin } from "vite"
import solidPlugin from "vite-plugin-solid"
import path from "path"
import fs from "fs"
import {
  OVERLAY_SIZE_CONTRACT_MARKER,
  readOverlaySizeContract,
  renderOverlaySizeContractStyle,
} from "./script/overlay-size-contract"

const overlayPackage = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as {
  version: string
}
const overlayVersion = overlayPackage.version
const overlaySizeContract = readOverlaySizeContract(path.resolve(__dirname, "src-tauri", "tauri.conf.json"))
const codeMirrorDedupePackages = [
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
]

function copyStaticAssets(entries: string[]): Plugin {
  function copyRecursive(src: string, dest: string) {
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true })
      for (const child of fs.readdirSync(src)) {
        copyRecursive(path.join(src, child), path.join(dest, child))
      }
    } else {
      fs.copyFileSync(src, dest)
    }
  }

  return {
    name: "copy-static-assets",
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, "dist-vite")
      for (const entry of entries) {
        const src = path.resolve(__dirname, "src", entry)
        const dest = path.resolve(outDir, entry)
        if (fs.existsSync(src)) {
          copyRecursive(src, dest)
        }
      }
    },
  }
}

function injectOverlayVersion(): Plugin {
  return {
    name: "inject-overlay-version",
    transformIndexHtml(html) {
      return html.replaceAll("%OPENCORVUS_OVERLAY_VERSION%", overlayVersion)
    },
  }
}

function injectOverlaySizeContract(): Plugin {
  return {
    name: "inject-overlay-size-contract",
    transformIndexHtml(html, context) {
      const normalizedFilename = context.filename.replaceAll("\\", "/")
      if (!normalizedFilename.endsWith("/index.html")) return html
      if (!html.includes(OVERLAY_SIZE_CONTRACT_MARKER)) {
        throw new Error("index.html is missing the overlay size contract marker.")
      }
      return html.replace(OVERLAY_SIZE_CONTRACT_MARKER, renderOverlaySizeContractStyle(overlaySizeContract))
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [solidPlugin(), injectOverlayVersion(), injectOverlaySizeContract(), copyStaticAssets(["i18n", "licenses"])],
  define: {
    __OPENCORVUS_OVERLAY_VERSION__: JSON.stringify(overlayVersion),
    __OPENCORVUS_BUILD_PLATFORM__: JSON.stringify(process.platform),
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "solid-js",
  },
  root: "src",
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, "..", "..")],
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    outDir: "../dist-vite",
    emptyOutDir: true,
    target: "esnext",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src", "index.html"),
        "native-menu": path.resolve(__dirname, "src", "native-menu.html"),
      },
    },
  },
  resolve: {
    conditions: ["source", ...defaultClientConditions],
    alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
    dedupe: codeMirrorDedupePackages,
  },
})
