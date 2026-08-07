#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencorvus-ai/script"
import { fileURLToPath } from "url"
import { isPublishedCliBinaryPackageName } from "./published-package-bin.mjs"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const binaryPkg = await Bun.file(`./dist/${filepath}`).json()
  if (!isPublishedCliBinaryPackageName(binaryPkg.name)) continue
  binaries[binaryPkg.name] = binaryPkg.version
}
console.log("binaries", binaries)
if (Object.keys(binaries).length === 0) {
  throw new Error("No CLI binary packages found in ./dist")
}
if (new Set(Object.values(binaries)).size !== 1) {
  throw new Error("CLI binary package versions must match before publishing")
}
const version = Object.values(binaries)[0]

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`mkdir -p ./dist/${pkg.name}/script`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/script/postinstall.mjs`
await $`cp ./script/published-package-bin.mjs ./dist/${pkg.name}/script/published-package-bin.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai",
      type: "module",
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "node ./script/postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(`./dist/${name}`)
})
await Promise.all(tasks)
await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel}`

const image = "ghcr.io/yangheng95/opencorvus"
const platforms = "linux/amd64,linux/arm64"
const tags = [`${image}:${version}`, `${image}:${Script.channel}`]
const tagFlags = tags.flatMap((t) => ["-t", t])
await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`

// registries
if (!Script.preview) {
  // Calculate SHA values
  const arm64Sha = await $`sha256sum ./dist/opencorvus-linux-arm64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const x64Sha = await $`sha256sum ./dist/opencorvus-linux-x64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const macX64Sha = await $`sha256sum ./dist/opencorvus-darwin-x64.zip | cut -d' ' -f1`.text().then((x) => x.trim())
  const macArm64Sha = await $`sha256sum ./dist/opencorvus-darwin-arm64.zip | cut -d' ' -f1`.text().then((x) => x.trim())

  const [pkgver, _subver = ""] = Script.version.split(/(-.*)/, 2)

  // arch
  const binaryPkgbuild = [
    "# Maintainer: dax",
    "# Maintainer: adam",
    "",
    "pkgname='opencorvus-bin'",
    `pkgver=${pkgver}`,
    `_subver=${_subver}`,
    "options=('!debug' '!strip')",
    "pkgrel=1",
    "pkgdesc='The AI coding agent built for the terminal.'",
    "url='https://github.com/yangheng95/opencorvus'",
    "arch=('aarch64' 'x86_64')",
    "license=('MIT')",
    "provides=('opencorvus')",
    "conflicts=('opencorvus')",
    `source_aarch64=("\${pkgname}_\${pkgver}_aarch64.tar.gz::https://github.com/yangheng95/opencorvus/releases/download/v\${pkgver}\${_subver}/opencorvus-linux-arm64.tar.gz")`,
    `sha256sums_aarch64=('${arm64Sha}')`,

    `source_x86_64=("\${pkgname}_\${pkgver}_x86_64.tar.gz::https://github.com/yangheng95/opencorvus/releases/download/v\${pkgver}\${_subver}/opencorvus-linux-x64.tar.gz")`,
    `sha256sums_x86_64=('${x64Sha}')`,
    "",
    "package() {",
    '  install -Dm755 ./opencorvus "${pkgdir}/usr/bin/opencorvus"',
    "}",
    "",
  ].join("\n")

  const maxAurUpdateAttempts = 30
  for (const [pkg, pkgbuild] of [["opencorvus-bin", binaryPkgbuild]]) {
    for (let i = 0; i < maxAurUpdateAttempts; i++) {
      try {
        await $`rm -rf ./dist/aur-${pkg}`
        await $`git clone ssh://aur@aur.archlinux.org/${pkg}.git ./dist/aur-${pkg}`
        await $`cd ./dist/aur-${pkg} && git checkout master`
        await Bun.file(`./dist/aur-${pkg}/PKGBUILD`).write(pkgbuild)
        await $`cd ./dist/aur-${pkg} && makepkg --printsrcinfo > .SRCINFO`
        await $`cd ./dist/aur-${pkg} && git add PKGBUILD .SRCINFO`
        await $`cd ./dist/aur-${pkg} && git commit -m "Update to v${Script.version}"`
        await $`cd ./dist/aur-${pkg} && git push`
        break
      } catch (e) {
        if (i === maxAurUpdateAttempts - 1) {
          throw new Error(`AUR update failed after ${maxAurUpdateAttempts} attempts for ${pkg}`, { cause: e })
        }
        continue
      }
    }
  }

  // Homebrew formula
  const homebrewFormula = [
    "# typed: false",
    "# frozen_string_literal: true",
    "",
    "# This file was generated by GoReleaser. DO NOT EDIT.",
    "class OpenCorvus < Formula",
    `  desc "The AI coding agent built for the terminal."`,
    `  homepage "https://github.com/yangheng95/opencorvus"`,
    `  version "${Script.version.split("-")[0]}"`,
    "",
    "  on_macos do",
    "    if Hardware::CPU.intel?",
    `      url "https://github.com/yangheng95/opencorvus/releases/download/v${Script.version}/opencorvus-darwin-x64.zip"`,
    `      sha256 "${macX64Sha}"`,
    "",
    "      def install",
    '        bin.install "opencorvus"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm?",
    `      url "https://github.com/yangheng95/opencorvus/releases/download/v${Script.version}/opencorvus-darwin-arm64.zip"`,
    `      sha256 "${macArm64Sha}"`,
    "",
    "      def install",
    '        bin.install "opencorvus"',
    "      end",
    "    end",
    "  end",
    "",
    "  on_linux do",
    "    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/yangheng95/opencorvus/releases/download/v${Script.version}/opencorvus-linux-x64.tar.gz"`,
    `      sha256 "${x64Sha}"`,
    "      def install",
    '        bin.install "opencorvus"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/yangheng95/opencorvus/releases/download/v${Script.version}/opencorvus-linux-arm64.tar.gz"`,
    `      sha256 "${arm64Sha}"`,
    "      def install",
    '        bin.install "opencorvus"',
    "      end",
    "    end",
    "  end",
    "end",
    "",
    "",
  ].join("\n")

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN is required to update homebrew tap")
    process.exit(1)
  }
  const tap = `https://x-access-token:${token}@github.com/yangheng95/homebrew-tap.git`
  await $`rm -rf ./dist/homebrew-tap`
  await $`git clone ${tap} ./dist/homebrew-tap`
  await Bun.file("./dist/homebrew-tap/opencorvus.rb").write(homebrewFormula)
  await $`cd ./dist/homebrew-tap && git add opencorvus.rb`
  await $`cd ./dist/homebrew-tap && git commit -m "Update to v${Script.version}"`
  await $`cd ./dist/homebrew-tap && git push`
}
