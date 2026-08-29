import { readFileSync } from "node:fs"

const channelRuntimeManifest = JSON.parse(
  readFileSync(new URL("./packages/channel-runtime/package.json", import.meta.url), "utf8"),
)
const catalogLoadedOpenClawPackages = Object.keys(channelRuntimeManifest.dependencies).filter((name) =>
  name.startsWith("@openclaw/"),
)

export default {
  entry: ["nix/scripts/**/*.ts!", "script/**/*.ts!"],
  project: ["nix/scripts/**/*.ts!", "script/**/*.ts!"],
  ignore: [
    "backups/**",
    "packages/overlay/src-tauri/**",
    "packages/opencorvus/.opencorvus/**",
    "packages/opencorvus/.turbo/**",
    "packages/opencorvus/dist/**",
    "packages/opencorvus/eval-prd-workspace/**",
    "packages/opencorvus/eval-workspace-*/**",
  ],
  ignoreBinaries: [
    // Process occurrence and supervision read the operating system's own
    // process table; `ps` ships with the host, not with this repository.
    "ps",
    "osascript",
    "powershell.exe",
    "wl-paste",
    "xclip",
    "choco",
    "gh",
    "opencorvus",
    "powershell",
    "mix",
    "tar",
    "xcrun",
    "java",
    "brew",
    "scoop",
  ],
  workspaces: {
    "packages/channel-config": {
      entry: ["src/index.ts!"],
      project: ["src/**/*.ts!"],
    },
    "packages/channel-runtime": {
      entry: ["src/index.ts!", "src/main.ts!", "src/openclaw-sidecar.ts!"],
      project: ["src/**/*.ts!"],
      // The shared channel catalog chooses these official package entries at
      // runtime, so static dependency analysis cannot observe their imports.
      ignoreDependencies: catalogLoadedOpenClawPackages,
    },
    "packages/opencorvus": {
      entry: ["src/index.ts!", "bin/opencorvus!"],
      project: ["src/**/*.ts!"],
      ignore: ["script/**", "test/**"],
      // Bun compile keeps these package-relative browser runtimes in the
      // colocated node_modules tree; the scroll-slice Node sidecar loads
      // playwright from its generated script, and build-artifact tests verify
      // the runtime copies.
      ignoreDependencies: ["chromium-bidi", "playwright", "playwright-core"],
    },
    "packages/overlay": {
      entry: [
        "script/build.ts",
        "script/build-overlay.ts",
        "script/build-docker.ts",
        // src/main.tsx is the Solid entry point — vite.config.ts roots
        // at `src/` and uses src/index.html as the HTML host that loads
        // /main.tsx via the standard <script type="module"> tag.
        "src/index.html!",
        "src/main.tsx!",
        // The native menu surface is the second production Vite entry
        // (vite.config.ts `native-menu`); its HTML host loads /native-menu.tsx
        // through a Vite-root-absolute path this analysis cannot follow.
        "src/native-menu.html!",
        "src/native-menu.tsx!",
      ],
      project: ["script/**/*.ts", "src/**/*.{ts,tsx,js}!", "vite.config.ts"],
      ignore: ["src-tauri/**", "test/**", "node_modules/**", "dist/**", "dist-vite/**"],
    },
    "packages/plugin": {
      entry: ["src/index.ts!", "src/tool.ts!"],
      project: ["src/**/*.ts!"],
    },
    "packages/script": {
      entry: ["src/index.ts!"],
      project: ["src/**/*.ts!"],
    },
    "packages/sdk/js": {
      entry: [
        "src/index.ts!",
        "src/client.ts!",
        "src/gen/client/index.ts!",
        "src/server.ts!",
        "src/defaults.ts!",
        "src/expert-squad-authoring.ts!",
      ],
      project: ["src/**/*.ts!"],
    },
    "packages/util": {
      entry: ["src/**/*.ts!"],
      project: ["src/**/*.ts!"],
    },
  },
}
