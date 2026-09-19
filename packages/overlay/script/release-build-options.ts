export function overlayBundleTargets(platform: NodeJS.Platform): string[] {
  if (platform === "linux") return ["deb", "rpm", "appimage"]
  if (platform === "darwin") return ["app", "dmg"]
  if (platform === "win32") return ["msi", "nsis"]
  throw new Error(`Unsupported installer platform: ${platform}`)
}

export function parseOverlayReleaseBuildArgs(argv: readonly string[], platform = process.platform) {
  const targets = overlayBundleTargets(platform)
  if (argv.length === 0) return { compile: true, bundles: targets }
  if (argv.length === 1 && argv[0] === "--no-bundle") return { compile: true, bundles: [] }
  if (argv.length === 2 && argv[0] === "--bundle" && platform === "linux" && targets.includes(argv[1]!)) {
    return { compile: false, bundles: [argv[1]!] }
  }
  throw new Error("Usage: build.ts [--no-bundle | --bundle <deb|rpm|appimage> (Linux only)]")
}
