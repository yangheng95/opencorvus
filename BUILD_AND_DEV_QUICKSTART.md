# Build and Dev Quickstart

本文档是 OpenCorvus 本地编译、CLI 打包、客户端程序包打包、客户端开发启动的简版命令速查。

## 1. 基础环境

Windows 本地建议准备：

- Bun：`1.3.14`
- Rust/Cargo：`stable-x86_64-pc-windows-msvc`
- PowerShell
- 可访问 npm registry 和公司 LiteLLM/模型服务网络

当前 PowerShell 会话建议先设置：

```powershell
$env:Path = "C:\Users\lichenxing\.cargo\bin;C:\Users\lichenxing\.bun\bin;$env:Path"
$env:HUSKY = "0"
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:OPENCORVUS_VERSION = "0.0.25-beta"
$env:OPENCORVUS_CHANNEL = "local"
$env:OPENCORVUS_BUN_RUNTIME_DIR = "D:\mirror-git\mirror-new\opencorvus\.local-bun-runtimes-1"
```

安装依赖：

```powershell
bun install --registry=https://registry.npmmirror.com
```

## 2. 本地编译 CLI

编译 SDK：

```powershell
bun run --cwd packages/sdk/js build
```

编译 OpenCorvus Windows CLI：

```powershell
bun run --cwd packages/opencorvus script/build.ts --single --baseline --no-clean
```

输出目录：

```text
packages/opencorvus/dist/opencorvus-windows-x64/opencorvus.exe
packages/opencorvus/dist/opencorvus-windows-x64-baseline/opencorvus.exe
```

验证：

```powershell
& packages\opencorvus\dist\opencorvus-windows-x64\opencorvus.exe --version
& packages\opencorvus\dist\opencorvus-windows-x64-baseline\opencorvus.exe --version
```

## 3. 打 CLI 程序包

如果已经执行过本地 CLI 编译，可以直接归档：

```powershell
bun run package:native-binary --skip-build
```

输出：

```text
packages/opencorvus/dist/opencorvus-windows-x64.tar.gz
packages/opencorvus/dist/opencorvus-windows-x64-baseline.tar.gz
```

也可以使用矩阵入口打当前系统支持的 CLI 包：

```powershell
bun run package:binary-matrix
```

CLI 包是便携式压缩包，不是桌面安装器。使用时解压整个目录，不要只拷贝单个 `opencorvus.exe`。

## 4. 打客户端程序包

客户端程序包是 Tauri Overlay 桌面客户端。

执行：

```powershell
bun run package:gui-installer-matrix
```

Windows x64 输出：

```text
packages/overlay/dist-artifacts/windows-x64/opencorvus-overlay.exe
packages/overlay/dist-artifacts/windows-x64/OpenCorvus_0.0.25-beta_x64-setup.exe
packages/overlay/dist-artifacts/windows-x64/OpenCorvus_0.0.25-beta_x64_en-US.msi
```

推荐分发安装包：

```text
OpenCorvus_0.0.25-beta_x64-setup.exe
```

## 5. 启动客户端开发模式

完整客户端开发模式：

```powershell
bun run --cwd packages/overlay dev
```

该命令会自动启动：

- Vite dev server：`http://localhost:5173/`
- Tauri 桌面客户端：`packages/overlay/src-tauri/target/debug/opencorvus-overlay.exe`

如果只想启动前端页面，不启动桌面壳：

```powershell
bun run --cwd packages/overlay dev:vite
```

## 6. 常用产物验证

检查 CLI 压缩包：

```powershell
Get-ChildItem -LiteralPath packages\opencorvus\dist -Filter "opencorvus-windows-x64*.tar.gz" |
  Select-Object FullName,Length,LastWriteTime
```

检查客户端安装包：

```powershell
Get-ChildItem -LiteralPath packages\overlay\dist-artifacts\windows-x64 |
  Select-Object FullName,Length,LastWriteTime
```

检查客户端开发服务：

```powershell
Invoke-WebRequest -Uri http://localhost:5173/ -UseBasicParsing
Get-Process opencorvus-overlay -ErrorAction SilentlyContinue
```
