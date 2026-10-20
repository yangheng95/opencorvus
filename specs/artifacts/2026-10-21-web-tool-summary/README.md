# 网页工具摘要与来源阅读

2026-10-21，单开发 agent，实际隔离开发 `/ui`，人工交互和截图。方案与根因见[记录](../../records/2026-10/2026-10-21-web-tool-summary.md)。

## 改动与资格

真实 webfetch 完成标题包含请求 URL（Uniform Resource Locator，资源地址）与响应媒体/编码，旧工具摘要直接使用该标题。来源标题已可读，但窄主区的工具行出现 `text/html; c…` 和 `(t…` 残片。本轮在唯一摘要投影按精确 webfetch 工具读取结构化请求 URL，原地址完整保留；完整响应标题放入原展开详情，原输入与实际输出仍可查看。Sources 的标题、站点、链接、绑定和原时间顺序没有改动。

人工查看全部11张实图，04相对02的同一窄区能显示两个完整请求 URL；05/06原媒体类型、编码、参数与真实输出可见，10/11中文标签可读且出版/工具原文保持真实。09实际键盘聚焦第一来源并显示完整标题、地址及本地化“网页读取”。03有悬浮 Agent activity 提示遮挡来源，保留该早期图片，不将其作为清晰宽区结果；07收起详情回宽区后目标区域可读，顶部独立用量提示不遮来源。没有新模型流、本轮成员网页场景或完整 Rendering 连续帧资格，不能宣称全部闪烁已修复。

| 图片 | 实际操作 |
| --- | --- |
| [01](01-before-wide.png)、[02](02-before-narrow.png) | 冻结482正式前端；同一真实会话宽区/打开右栏 |
| [03](03-after-wide.png)、[04](04-after-narrow.png) | 最终本轮构建；03悬浮遮挡保留，04为清晰窄区结果 |
| [05](05-after-result-details.png)、[06](06-after-request-details.png) | 展开真实工具结果与完整结构化请求 |
| [07](07-after-wide-return.png)、[08](08-after-zh.png) | 收起回宽区、设置切换中文并返回同一会话 |
| [09](09-after-source-focus.png) | 键盘 Shift+Tab 从复制动作返回原来源焦点，完整提示 |
| [10](10-after-zh-narrow.png)、[11](11-after-zh-result.png) | 中文窄区、中文输入/输出与原响应标题 |

## 原始数据与收尾

[before完整事实](before-verified.json)、[after公开读取](after-verified.json)和[after终态数据库](after-settled-verified.json)：原七表87行（4 Project、4 Session、14 Message、33 Part、28 protocol_event、2 request、2 outcome）逐项保留 rowid、全部字段和时间；原源库大小/mtime 与全部行相同。每个副本仅增加自己的1个 Project，最终各5 Project/4 Session/schema3，canonical仍 `{}`。公开原 Session 200，两条真实 Source 仍分别绑定原真实 webfetch；原结果5088/16346字符。源为自有已关闭482数据，无用户库操作或迁移。

[原生收尾](owned-scopes.json)：before原39640/18847、after原19152/18849均公开 shutdown200，原句柄 join0，精确物理/output/request/launcher 全部结算；自有53/54页关闭。未复制凭据/模型目录、未发预检或新模型输入，旧批预算不复活，用户18571未操作。

私有检查器首次把 JSON（JavaScript Object Notation，结构化对象文本）data 当成包含 Part id 的完整行，实际 id/message_id 属于关系列；原 fe0fc9 200读取后校验失败，修正真实列映射并重跑原 checker，未修改产品或原数据。首次关闭用 Windows PowerShell 5 运行依赖 ProcessStartInfo.ArgumentList 的现有工具，原713390 exit1；改用 PowerShell7正常关闭同一原scope，未重启服务。一次 apply_patch 因上下文不匹配未应用，随后复核差异并精确重做。未新增、修改或运行界面自动化测试。

## 辅助检查与边界

[最终 UI 构建](ui-build-final.log)原66071 exit0，51.35秒，`bun run build:overlay --skip-tauri`；[最终类型](ui-typecheck-final.log)原14580 exit0；[语言](i18n.log)两语言2523键。[文档](docs.log)与[架构索引](architecture.log)独立检查，均不替代人工视觉验收。`prepare.ts.txt`/`verify.ts.txt`是隔离运行与非界面数据检查的可审查输入，不是浏览器或组件测试。
归档构建日志规范行末空白，原始 scratch 日志保留；不改写输出内容或检查结论。

原配置保存10秒/恢复5秒仍未达，本轮没有更改该路径。只交付界面摘要与展开信息；没有版本更新、发布或所有跨平台/成员/实时流资格。
