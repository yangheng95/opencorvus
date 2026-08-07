# OpenCorvus Local Packaging Guide

本文档记录在 Windows 本地安装依赖、编译并打包 OpenCorvus native CLI bundle 的环境信息和执行流程。

## 已验证环境

- 操作系统：Windows x64
- Shell：PowerShell
- Bun：`1.3.14`
- Rust toolchain：`stable-x86_64-pc-windows-msvc`
- Cargo 路径：`C:\Users\lichenxing\.cargo\bin`
- Bun 路径：`C:\Users\lichenxing\.bun\bin`
- Node 堆内存：建议设置 `NODE_OPTIONS=--max-old-space-size=8192`
- 依赖 registry：建议使用 `https://registry.npmmirror.com`

项目根目录 `package.json` 指定的包管理器是：

```text
bun@1.3.14
```

## 一次性环境准备

安装 Bun：

```powershell
irm bun.sh/install.ps1 | iex
```

如果需要安装项目指定版本，可以下载 Bun installer 后指定版本安装：

```powershell
Invoke-WebRequest https://bun.sh/install.ps1 -OutFile $env:TEMP\bun-install.ps1
& $env:TEMP\bun-install.ps1 -Version 1.3.14
```

安装 Rust/Cargo：

```powershell
Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile $env:TEMP\rustup-init.exe
& $env:TEMP\rustup-init.exe -y --no-modify-path
```

当前 PowerShell 会话中补齐工具路径：

```powershell
$env:Path = "C:\Users\lichenxing\.cargo\bin;C:\Users\lichenxing\.bun\bin;$env:Path"
```

## 依赖安装

从项目根目录执行：

```powershell
$env:HUSKY = "0"
bun install --registry=https://registry.npmmirror.com
```

当前环境中使用内部 npm registry 时，可能无法解析 `vite@^6`，因此建议显式指定 npmmirror registry。

如果 Windows 下 `bun install` 在 `@univerjs-pro/collaboration@0.25.1` 处出现 link/copyfile 失败，可以先清理 Bun 缓存后重试：

```powershell
bun pm cache rm
$env:HUSKY = "0"
bun install --registry=https://registry.npmmirror.com
```

如果仍失败，需要确认 `node_modules/@univerjs-pro/collaboration/package.json` 是否存在。当前本机打包时通过补齐 Bun 缓存中的该包后继续完成了后续构建。

## 本地打包流程

设置本次打包环境变量：

```powershell
$env:Path = "C:\Users\lichenxing\.cargo\bin;C:\Users\lichenxing\.bun\bin;$env:Path"
$env:HUSKY = "0"
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:OPENCORVUS_VERSION = "0.0.25-beta"
$env:OPENCORVUS_CHANNEL = "local"
```

编译 SDK：

```powershell
bun run --cwd packages/sdk/js build
```
编译 Rust process supervisor：

```powershell
cargo build --manifest-path packages/opencorvus/native/process-supervisor/Cargo.toml --release
```

准备 Bun runtime 目录。打包脚本需要普通 Windows x64 runtime 和 baseline runtime：

```powershell
$env:OPENCORVUS_BUN_RUNTIME_DIR = "D:\mirror-git\mirror-new\opencorvus\.local-bun-runtimes-1"
```

目录结构需要类似：

```text
.local-bun-runtimes-1/
  bun-windows-x64/
    bun.exe
  bun-windows-x64-baseline/
    bun.exe
```

如果脚本自动下载 baseline runtime 失败，可以从 Bun GitHub release 下载 `bun-windows-x64-baseline.zip`，解压后放入上述 `bun-windows-x64-baseline` 目录。

编译当前 Windows host 的 OpenCorvus binary：

```powershell
bun run --cwd packages/opencorvus script/build.ts --single --baseline --no-clean
```

归档 native binary package：

```powershell
bun run package:native-binary --skip-build
```

也可以使用矩阵入口执行当前 host 可验证行：

```powershell
bun run package:binary-matrix
```

如果已经手动完成 `packages/opencorvus/script/build.ts`，建议使用 `package:native-binary --skip-build`，避免重复触发 runtime 下载和完整编译。

## 产物位置

Windows native CLI bundle 产物位于：

```text
packages/opencorvus/dist/opencorvus-windows-x64.tar.gz
packages/opencorvus/dist/opencorvus-windows-x64-baseline.tar.gz
```

解包目录位于：

```text
packages/opencorvus/dist/opencorvus-windows-x64/
packages/opencorvus/dist/opencorvus-windows-x64-baseline/
```

## 验证命令

检查归档文件：

```powershell
Get-ChildItem -LiteralPath packages\opencorvus\dist -Filter "opencorvus-windows-x64*.tar.gz" |
  Select-Object FullName,Length,LastWriteTime
```

检查 executable 版本：

```powershell
& packages\opencorvus\dist\opencorvus-windows-x64\opencorvus.exe --version
& packages\opencorvus\dist\opencorvus-windows-x64-baseline\opencorvus.exe --version
```

当前已验证输出：

```text
0.0.25-beta
0.0.25-beta
```

## 常见问题

### npm registry 缺包

现象：

```text
No version matching "^6" found for specifier "vite"
```

处理：

```powershell
bun install --registry=https://registry.npmmirror.com
```

### Vite build 内存不足

现象包括 JavaScript heap out of memory。

处理：

```powershell
$env:NODE_OPTIONS = "--max-old-space-size=8192"
```

### Cargo 不存在

现象：

```text
cargo: command not found
```

处理：安装 Rust 后，把 `C:\Users\lichenxing\.cargo\bin` 加入当前会话 `Path`。

### Bun baseline runtime 下载失败

现象包括下载 `bun-windows-x64-baseline-v1.3.14` 失败或连接被拒绝。

处理：手动下载 Bun release 中的 `bun-windows-x64-baseline.zip`，解压到 `OPENCORVUS_BUN_RUNTIME_DIR\bun-windows-x64-baseline`。

### SDK dist 缺失

现象：

```text
Cannot find module '@opencorvus-ai/sdk/expert-squad-authoring'
```

处理：

```powershell
bun run --cwd packages/sdk/js build
```
