# 0.1.51 发布证据

0.1.51 于上海时间 2026-11-12 19:47:03 公开，冻结源码为 `aacc6adb043d66212495f9a808c1d6443029a025`。[GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.51)

- 原生发布 23 项成功、6 项非适用跳过。五平台桌面与命令行包、Linux 三种格式以及真实首次运行和重启均通过。[原生发布](https://github.com/yangheng95/opencorvus/actions/runs/43208407888)
- 发布者实际返回的配对官网 8 项成功，站点部署与公开读回均通过。两工作流首轮成功，全程 33 分 05 秒。[配对官网](https://github.com/yangheng95/opencorvus/actions/runs/43212123569)
- 29 个公开资源、5 个稳定更新平台、18 个公开下载响应 200。GitHub 正文与冻结双语日志精确一致，旧 86 份日志及 26 个 Release 对象均保留。本版仅创建一个正式候选。

## 运行回执

- `release-result.json`、`native-run.json`、`website-run.json` 记录正式终态、实际包首次运行和重启、安装格式及官网激活。
- `prepare-owner.json`、`public-readback.json`、`public-downloads.json` 记录标签和初始草稿归属、公开对象完整性、稳定更新清单和下载响应。
- `intel-preflight.json`、`intel-proof.json` 记录 Intel Mac 预检、编译缓存和正式构建回执。
- `release-inventory-before.json`、`release-inventory-after.json`、`cleanup.json` 记录本版与历史发布对象状态。
- `published-cli-asset.json`、`published-ui-runtime.json`、`published-ui-settlement.json` 记录正式 Windows 包完整性、独立空实例的实际运行与结清。

## 实页复核

- `published-settings-en.jpg`、`published-settings-en-details.jpg`、`published-settings-zh.jpg`、`published-settings-zh-details.jpg` 展示正式 Windows 包内设置中的双语日志和数据库迁移说明。
- `website-changelog-zh.jpg`、`website-changelog-en.jpg` 展示实际配对部署后的双语日志，均经人工复核。[中文官网](https://opencorvus.com/zh-cn/changelog/0.1.51/) · [英文官网](https://opencorvus.com/changelog/0.1.51/)

冻结提交的类型、依赖与服务检查通过，三平台完整单元作业被后续主线更新取消。详见[发布记录](../../records/2026-11/2026-11-12-release-0.1.51.md)。
