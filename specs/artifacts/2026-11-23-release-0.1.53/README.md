# 0.1.53 发布证据

[方案与结果](../../records/2026-11/2026-11-23-release-0.1.53.md)。v0.1.53 已于上海时间 2026-11-23 发布，冻结源码 `33901838d60748e7a46d4136cecb4bed7c262a2f`。

- [本地聚焦验收](local-qualification.json)：九个相关后端文件 99 项、八个服务数据文件 146 项及 65 项版本/发布/日志合同通过；没有全量测试或真实模型覆盖声明。
- [Intel Mac 预检](https://github.com/yangheng95/opencorvus/actions/runs/45129477739) 首次成功，用时 13 分 35 秒；[原始首次启动与缓存回执](intel-preflight.json)、[实际依赖缓存对象](dependency-caches.json)。预检产品包不进入正式发布。
- [唯一正式原生流程](https://github.com/yangheng95/opencorvus/actions/runs/45131627338) 首次成功，23 项成功、6 项非适用跳过。原始创建 07:30:42 UTC，完成 07:59:37 UTC，共 28 分 55 秒，原始一小时预算未延长。[完整结果](release-result.json)、[原生作业](native-run.json) 和 [Intel 实际构建证据](intel-proof.json) 包含五平台 CLI（Command Line Interface，命令行界面）/桌面随包后端及 x64 基础变体的 13 条真实首次运行/重启回执；每条创建四会话、重启保留两个，`realProvider=false`。这些回执不代表五平台桌面窗口视觉验收。
- 发布者实际返回的 [配对官网](https://github.com/yangheng95/opencorvus/actions/runs/45134358380) 八项成功。其工作流定义来源为 `29fe8540e583f278318d17db3bd40a743fe383c4`，解析出的产品来源为上述冻结源码、父原生编号为 45131627338；[网站原始作业](website-run.json) 和完整结果保留准确身份及发布者完成关键行。
- [准入归属回执](prepare-owner.json) 在 tag（标签）精确指向本版来源、所属草稿仍为空时取得。最终 [GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.53) 的 29 项资源全部上传；[公开读回](public-readback.json) 核对不可变对象摘要、28 条实际资源完整性记录、五平台稳定更新清单及严格同源日志。[18 个实际公开下载响应](public-downloads.json) 均为 HTTP 200，所有初始链接精确属于本版资源。
- 根 CHANGELOG.md 是唯一编写来源。官网 [中文](https://opencorvus.com/zh-cn/changelog/0.1.53/) / [英文](https://opencorvus.com/changelog/0.1.53/) 完整实页已人工复核：[中文截图](public-website-zh-CN.jpg)、[英文截图](public-website-en-US.jpg)。版本、日期、分类与升级限制均完整可读。
- 从公开资源实际下载并验证 [Windows CLI 基础归档](published-cli-asset.json)，在自有空白隔离实例查看随包设置日志：[英文首屏](published-settings-en-US-top.jpg)、[英文末屏](published-settings-en-US-end.jpg)、[中文首屏](published-settings-zh-CN-top.jpg)、[中文末屏](published-settings-zh-CN-end.jpg)。[运行回执](published-ui-runtime.json) 与 [物理结清证据](published-ui-settlement.json) 确认公共关闭 200、准确自有进程及监听器退出、临时目录移除。未转移凭据、发送消息或启动任务，没有用户进程操作。
- [发布前清单](release-inventory-before.json) 的 28 个历史对象均完整保留，[发布后清单](release-inventory-after.json) 仅新增本版，共 29 个。[清理记录](cleanup.json) 保留 89 版已编写日志；本轮只有一次候选和一次原生尝试，没有失败候选需要撤回。

数据库保持结构版本 13，保留已有项目、会话和任务。macOS 安装包仍采用临时签名，尚未经过 Apple 公证。本轮没有全量后端套件、全部产品工作流或真实模型的覆盖声明。
