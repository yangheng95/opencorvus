# 0.1.50 发布证据

OpenCorvus 0.1.50 于上海时间 2026-11-10 02:09:43 公开，冻结源码为 `7de5a4cc43216aa96f1bd9817873e7d217caa964`。[GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.50)

- 五平台原生桌面和命令行打包、首次运行、Linux 三种安装格式、29 个资源上传以及稳定更新通过。原配对官网因 GitHub Actions 故障未完成调度，原生合并发布运行到期取消，原配对官网失败。[原生运行](https://github.com/yangheng95/opencorvus/actions/runs/42667149084) · [原配对官网](https://github.com/yangheng95/opencorvus/actions/runs/42671553483) · [GitHub 故障公告](https://stspg.io/7yw63xl9ztrv)
- 同一个官网工作流的正常部署入口补齐了官网下载，八项全部成功，耗时 6 分 24 秒。官网和桌面稳定更新现均提供 0.1.50。18 个实际公开下载链接返回 HTTP 200。[官网补部署](https://github.com/yangheng95/opencorvus/actions/runs/42676413551)
- GitHub 正文与冻结日志逐字一致，旧 85 份日志及 25 个 Release 对象均逐项保留。本版只创建一个正式发布对象。

## 运行回执

- `release-result.json`、`native-run.json`、`website-original-run.json`、`website-recovery-run.json` 记录实际终态、13 份包内首次运行和重启回执以及最终官网激活。
- `prepare-owner.json`、`public-readback.json`、`public-downloads.json` 记录标签与初始草稿归属、公开资源完整性、五平台稳定更新和 18 个下载响应。
- `intel-preflight.json` 记录预检、实际缓存命中、两份源码缓存输入核对和首次运行。正式包由冻结源码重新构建。
- `release-inventory-before.json`、`release-inventory-after.json` 记录本版和历史发布状态。
- `published-cli-asset.json`、`published-ui-runtime.json`、`published-ui-settlement.json` 记录正式 Windows 包下载、独立空实例以及资源结清。实页验收未使用真实模型。

## 实页复核

- `published-settings-en.jpg`、`published-settings-en-details.jpg`、`published-settings-zh.jpg` 展示公开下载包中英日志。`published-settings-date-search.jpg` 展示按 `2026-11-10` 找到本版。
- `website-changelog-zh.jpg`、`website-changelog-en.jpg` 展示公开站点的中英版本日志，均由同一份冻结根日志生成。通过页面语言链接切换并查看。六张截图均人工复核。[中文官网](https://opencorvus.com/zh-cn/changelog/0.1.50/) · [英文官网](https://opencorvus.com/changelog/0.1.50/)

最后一个产品提交的类型、依赖和服务检查通过，三平台完整单元作业被后续主线更新取消。准入、影响、故障和交付细节见[发布记录](../../records/2026-11/2026-11-10-release-0.1.50.md)。
