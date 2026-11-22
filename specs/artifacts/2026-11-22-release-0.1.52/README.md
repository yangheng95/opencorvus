# 0.1.52 发布证据

[方案与结果](../../records/2026-11/2026-11-22-release-0.1.52.md)。v0.1.52 已于上海时间 2026-11-22 发布，冻结源码 `cf5e9a015bdbc477b5726a6f7519aa8156dae7ba`。

- [Intel Mac 预检](https://github.com/yangheng95/opencorvus/actions/runs/45031837904) 首次成功，用时 16 分 17 秒。[实际构建、重启和缓存证据](intel-preflight.json)。
- [初次三平台定向 CI](https://github.com/yangheng95/opencorvus/actions/runs/45031845032) 暴露共同的测试宿主发布归属清理缺失；失败记录保留。修复后的 [20 文件三平台重查](https://github.com/yangheng95/opencorvus/actions/runs/45034191153) 成功，[逐文件原生回执](selected-ci.json) 覆盖 60 次成功结束，另含原服务、类型与依赖审计检查；这不是整个后端测试套件的通过声明。
- [唯一正式原生流程](https://github.com/yangheng95/opencorvus/actions/runs/45036081992) 第二次尝试成功，23 项成功、6 项非适用跳过。原始创建 15:02:36 UTC，完成 15:36:03 UTC，共 33 分 27 秒，原始一小时预算未延长。[完整结果](release-result.json)、[原生作业](native-run.json) 和 [Intel 实际构建证据](intel-proof.json) 覆盖五平台 CLI（命令行界面）与桌面入口的真实首次启动、四个会话创建及重启后两个会话保留；使用 `realProvider=false`。
- 最终发布者实际返回的 [配对官网](https://github.com/yangheng95/opencorvus/actions/runs/45038512820) 八项成功。其工作流来源为 `fba0757b455581152a089d5cc44b6f3a495f84a4`，resolver（来源解析器）明确解析产品来源为冻结源码、父原生流程为 45036081992；[官网原始作业](website-run.json) 与完整结果保留这个区别。
- 第一次网站分派后约半秒读取精确运行返回 404，父作业失败并取消首次官网。按现有流程仅重跑原生流程失败作业后成功；未删除已公开健康版本或更改标签。[失败、恢复及后续主线修复记录](publication-recovery.json) 明确该修复不属于已冻结版本。
- [GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.52) 的 29 项资源全部上传；[公开读回](public-readback.json) 核对不可变资源摘要、28 条实际资源校验记录、五平台稳定更新与同源日志。[官网 18 个实际下载响应](public-downloads.json) 均为 HTTP 200，链接均属于本版公开资源。
- 版本日志只编写在根 CHANGELOG.md；GitHub 正文与冻结源码完全相同，官网 [中文](https://opencorvus.com/zh-cn/changelog/0.1.52/) / [英文](https://opencorvus.com/changelog/0.1.52/) 实页均已人工视觉复核：[中文官网截图](public-website-zh-CN.jpg)、[英文官网截图](public-website-en-US.jpg)。
- 从公开资源下载并验证 [Windows CLI 不可变归档](published-cli-asset.json)，在自有空白隔离实例查看随包设置日志，未转移凭据、发送消息或启动任务：[英文首屏](published-settings-en-US-top.jpg)、[英文末屏](published-settings-en-US-end.jpg)、[中文首屏](published-settings-zh-CN-top.jpg)、[中文末屏](published-settings-zh-CN-end.jpg)。[运行回执](published-ui-runtime.json) 与 [结清证据](published-ui-settlement.json) 确认公共关闭返回 200、自有进程和监听器消失、精确临时目录删除；未操作用户进程。
- [发布前清单](release-inventory-before.json) 的 27 个历史对象均完整保留，[发布后清单](release-inventory-after.json) 仅新增本版，总计 28 个。[清理记录](cleanup.json) 保留 88 版已编写日志，没有失败版本候选需要撤回。

数据库保持 schema（数据库结构版本）13，保留现有项目、会话和任务。macOS 安装包采用临时签名，尚未经过 Apple 公证。本次未进行真实模型验收，也不对所有产品工作流作覆盖声明。
