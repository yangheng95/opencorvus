# 0.1.49 发布证据

0.1.49 已于 2026-11-09 12:09:27 UTC 公开，冻结源码为 `b0caf6d618802e131db6339982c6a2f82d5fcac1`。[GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.49)

- 正式原生发布 23 项成功、6 项非适用跳过，含五个平台的桌面与命令行包及 Linux 三种安装格式。[原生发布](https://github.com/yangheng95/opencorvus/actions/runs/42611607513)
- 发布者实际返回的配对官网 8 项成功。核对了原生父运行、实际网站内容来源和公开读回。两条工作流均首轮通过，从 11:46:00 UTC 到 12:15:51 UTC 共 29 分 51 秒，原截止 12:46:00 UTC。[配对官网](https://github.com/yangheng95/opencorvus/actions/runs/42614669875)
- 29 个公开资源、5 个桌面更新平台、18 个公开下载实际返回 200。GitHub 双语正文精确匹配冻结根日志，84 份既有日志及 24 个既有 Release 对象逐项保留。本版只创建一个正式候选。

## 机器回执

- `release-result.json`、`native-run.json`、`website-run.json` 记录正式终态、13 份真实包首次运行和重启回执、安装格式验证、官网激活。
- `prepare-owner.json`、`public-readback.json`、`public-downloads.json` 记录标签和空草稿归属、公开对象完整性、稳定更新清单和实际下载响应。
- `intel-preflight.json`、`intel-proof.json` 记录 Intel 预检、缓存保存和正式编译及首次运行。预检的安装资源没有用于公开发布。
- `release-inventory-before.json`、`release-inventory-after.json`、`cleanup.json` 记录本版及已有版本的发布身份与状态。
- `published-cli-asset.json`、`published-ui-runtime.json`、`published-ui-settlement.json` 记录公开 Windows 包的真实下载、独立实例与资源结清。使用空实例，未进行真实模型请求。

## 实页复核

- `published-settings-en.jpg`、`published-settings-en-details.jpg`、`published-settings-zh.jpg` 展示随正式包交付的中英文设置日志和升级限制。
- `website-changelog-zh.jpg`、`website-changelog-en.jpg` 展示实际公开网站对应的双语日志，通过页面语言链接切换。[中文官网](https://opencorvus.com/zh-cn/changelog/0.1.49/) · [英文官网](https://opencorvus.com/changelog/0.1.49/)

五张截图均人工复核。常规 CI 的类型、依赖与服务检查通过，三平台完整单元作业被更新的主线运行取消。方案、边界与证据见[本版记录](../../records/2026-11/2026-11-09-release-0.1.49.md)。
