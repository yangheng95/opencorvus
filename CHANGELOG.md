# 更新日志

本文记录 OpenCorvus 从 `0.0.35beta` 开始的版本变化。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；产品版本使用 `0.0.35beta` 形式，代码元数据使用对应的 SemVer（Semantic Versioning，语义化版本）形式 `0.0.35-beta`。

## 未发布

### Changed

- 将 workspace 的 Bun 类型依赖和独立决策站点的包管理器规范统一到 Bun `1.3.14`，重新生成依赖锁定结果并移除旧 Bun 类型 package。

## 0.0.37beta - 2026-08-08

### Added

- 增加签名桌面热更新通道，并由发布矩阵统一生成和发布跨平台更新清单。
- 建立根更新日志，并在发布流程和中英文 README 中提供唯一入口。

### Changed

- 在中英文 README 顶部加入下载入口，直接指向按平台选择桌面安装包和命令行运行时的说明。

### Fixed

- 在共享启动流程中显式初始化原生 Task 进程模式，保持命令行与桌面打包运行一致。
- 打开模型选择框时刷新模型，进入 Providers 时刷新 Provider；刷新失败写入应用日志并保留界面可用性。

## 0.0.35beta - 2026-08-07

- 本版本是更新日志的记录起点；更早版本不在此倒推补录。
