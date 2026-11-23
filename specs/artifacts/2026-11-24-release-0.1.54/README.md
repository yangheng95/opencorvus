# 0.1.54 发布证据

[方案与结果](../../records/2026-11/2026-11-24-release-0.1.54.md)。v0.1.54 已于上海时间 2026-11-24 发布，冻结源码 `b136e6ec01cc21b5413e8f55ae0f4f7a6850adb9`。

- [本地聚焦验收](local-qualification.json)：五个相关后端文件 19 项、四个服务数据文件 38 项，以及 65 项版本/发布/日志合同通过，共 122 项。没有全量测试或真实模型覆盖声明；后续已验收界面交付的代码、正向合同和原始截图复核详见方案。
- [Intel Mac 预检](https://github.com/yangheng95/opencorvus/actions/runs/45226376119) 首次成功，用时 26 分 21 秒；[首次运行与实际编译回执](intel-preflight.json)、[实际缓存对象](dependency-caches.json)。原 Rust 缓存未命中，预检实际编译并由已有保存步骤建立缓存；正式 Intel 构建随后命中对应 Bun/Rust 缓存。预检产品包不进入正式发布。
- [唯一正式原生流程](https://github.com/yangheng95/opencorvus/actions/runs/45231354131) 首次成功，23 项成功、6 项非适用跳过。原始创建 17:47:01 UTC，完成 18:17:15 UTC，共 30 分 14 秒，原始一小时预算未延长。[完整结果](release-result.json)、[原生作业](native-run.json)、[Intel 正式构建](intel-proof.json) 保留 13 条实际首次运行和重启回执；各创建四会话、保留两个，`realProvider=false`。覆盖五平台 CLI（Command Line Interface，命令行界面）、桌面随包后端和 x64 基础变体，不代表五平台桌面窗口视觉验收。
- 原生发布者实际返回的 [精确配对官网](https://github.com/yangheng95/opencorvus/actions/runs/45235600867) 八项成功。其定义来源 `dac0af019b9b0522380b336597474ce59de655af`，解析出的产品来源为上述冻结源码，父原生编号为 45231354131；[原始网站作业](website-run.json) 和完整结果保留准确身份、激活及发布者完成关键行。
- [准入归属](prepare-owner.json) 在 tag（标签）准确指向本版、所属草稿仍为空时取得。[GitHub Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.54) 29 项资源全部上传；[公开读回](public-readback.json) 核对不可变对象完整性、28 条实际资源清单、五平台稳定更新及冻结同源日志。[18 个公开下载](public-downloads.json) 全部 HTTP（Hypertext Transfer Protocol，超文本传输协议）200，初始链接精确属于本版资源。
- 根 CHANGELOG.md 是唯一编写来源。官网 [中文](https://opencorvus.com/zh-cn/changelog/0.1.54/) / [英文](https://opencorvus.com/changelog/0.1.54/) 完整实页人工复核：[中文截图](public-website-zh-CN.jpg)、[英文截图](public-website-en-US.jpg)。版本、日期、分类和升级限制完整可读。
- 实际下载 [公开 Windows 基础 CLI 归档](published-cli-asset.json) 并核对 146,056,427 字节和服务对象摘要，在自有空白隔离实例查看随包设置日志：[英文首屏](published-settings-en-US-top.jpg)、[英文末屏](published-settings-en-US-end.jpg)、[中文首屏](published-settings-zh-CN-top.jpg)、[中文末屏](published-settings-zh-CN-end.jpg)。首末正文有重叠，覆盖完整本版。[运行回执](published-ui-runtime.json)、[物理结清](published-ui-settlement.json) 确认正式关闭 200、自有进程和监听器退出、临时目录移除。未转移凭据、发送消息或启动任务，真实模型请求预算为零；没有用户进程操作或界面自动化测试。
- [发布前清单](release-inventory-before.json) 29 个历史对象完整保留，[发布后清单](release-inventory-after.json) 仅新增本版，共 30 个。[清理记录](cleanup.json) 保留 90 版已编写日志；本轮只有一次成功候选和一次正式尝试，没有失败候选需要撤回。

数据库保持结构版本 13，保留已有项目、会话和任务。macOS 安装包仍采用临时签名，尚未 Apple 公证。本轮不宣称覆盖全部产品工作流或真实模型。
