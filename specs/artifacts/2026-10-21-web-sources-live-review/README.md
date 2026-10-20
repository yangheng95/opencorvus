# 真实网页 Sources 与阅读位置修复

2026-10-21，单开发 agent，实际 Web UI（User Interface，用户界面）与人工截图。生产改动仅涉及既有阅读锚点及其三个调用者；没有新增界面自动化测试。方案、根因和首轮返工见[月度记录](../../records/2026-10/2026-10-21-web-sources-live-review.md)。

## 结果与范围

实际网页读取保留两个完整标题、真实 URL（Uniform Resource Locator，资源地址）、站点与原 Tool/Message 身份。来源上方的旧消息曾优先成为阅读锚点：打开 Files 侧栏时聚焦来源从约 y331 移到 y521，第二来源离开阅读区。首轮仅优先焦点修复了打开，关闭后又被恢复结算重捕获的前文覆盖（15）。最终沿用原有阅读位置 Map 的可见 Source 锚点，当前来源焦点优先；侧栏关开和拖宽后均保持当前引用。

最终静态复核16—23：宽区来源约 y331、窄区约 y356，同时视口顶部122→146；关闭回到约 y331，再打开和拖宽仍保留原相对位置。两条来源均可读。明确返回最新和普通正文宽窄阅读正常。24—27在同一条真实 Sol 回复持续输出期间重做完整序列，通过人工查看；28显示自然完成和末尾标记。没有用像素断言或 DOM（Document Object Model，文档对象模型）文本断言代替视觉结果。

主会话本次有真实网页 Sources 的流式验收；SideChat 与成员面板使用同一个修复函数并完成调用审计及类型检查，本轮没有它们的真实网页 Sources 流式资格。未提供 snippet 的来源不制造摘录。前次完整配置保存10秒/恢复5秒门槛仍未达成，本轮不宣称修复了该性能问题或所有 Rendering 场景。

## 真实运行与数据

- [发现批](first-batch.json)：原96049/18831与63698/18833，6+4=10次实际 `gpt-6.1-sol` 流式请求，固定上限12；未使用2次随原批退休。[原公开来源与回复](first-batch-sources.json)记录两次真实 webfetch 成功及其 Source 绑定。
- [独立最终修复批](repair-batch.json)：原52835/18837，实际4/固定上限6（含两次凭据/模型预检及全部辅助调用），全部 HTTP（Hypertext Transfer Protocol，超文本传输协议）200、流式原 reader EOF（End Of File，原响应流读完）；剩余2次退休。没有重抓网页或创建成员任务。
- [四帧原流证据](repair-live-frames.json)：同一用户输入 `msg_c0cc30b7-8512-4732-8be9-2236cc620ee6`、同一 assistant `msg_g0VYc9hyi00QMA93XExo`，截图后读取分别640/1587/2234/3739字符，均未完成且原 reader `reading`。不是由 Running 徽章推断。
- [最终公开事实](repair-sources.json)：最终回复6005字符、`finish=stop`；6条原 Message、16条原 Part、两组 request/outcome 的 rowid、完整数据和时间逐项保留。当前独立数据4 Project/4 Session/14 Message/33 Part/schema3；canonical 配置仍为 `{}`。真实用户数据库与18571页面未操作。
- [两次无凭据静态 scope 结算](static-settlement.json)：原44087/18835为首轮候选，43263/18839为最终候选；公开 shutdown200、原句柄 exit0、精确物理/output/request/launcher 结算。
- [发现批凭据退休](first-credential-retirement.json)与[最终批凭据退休](repair-credential-retirement.json)：完整 auth/models 成对准备和退休；源凭据 metadata 未变、没有 refresh/exchange/源写入，完整 private 模型目录退休前与源逐字节相同。最终批1509文件/55,346,233字节经5个实际秘密值检查 clear。所有自有44—49页面关闭。

## 人工图片

| 图片 | 实际含义 |
| --- | --- |
| [01](01-real-input.png)、[02](02-live-body.png) | 实页输入；第一次正文流中阅读 |
| [03](03-original-input-after-output.png)、[04](04-completed-guide-start.png) | 第一次已完成后的原输入与正文，不能当 Sources 流中证据 |
| [05](05-real-source-title-tooltip.png)、[06](06-real-source-copied.png) | 完整真实标题/URL 提示；复制地址成功，原剪贴板恢复 |
| [07](07-original-sources-after-continue.png)、[08](08-original-sources-live-narrow.png) | 原来源在第二次真实输出期间，08窄区暴露跳动；具体原流区间见记录及发现批事实 |
| [09](09-focused-source-wide-before.png)、[10](10-focused-source-narrow-before.png) | 修改前完成态重复同一聚焦来源跳动 |
| [11](11-real-public-source-target.png) | 点击原第二来源后出现的真实公开 ACL 目标页；异步新页晚于最初清单出现 |
| [12](12-new-ui-history-loaded.png)—[15](15-new-ui-panel-closed.png) | 首轮候选实际加载、聚焦、打开与关闭；15失败，未作为最终修复交付 |
| [16](16-final-focused-source-wide.png)、[17](17-final-focused-source-narrow.png)、[18](18-final-focused-source-return.png) | 最终静态候选聚焦、打开、关闭 |
| [19](19-final-source-reopened.png)、[20](20-final-source-dock-resized.png) | 无重新聚焦，再打开和拖宽 |
| [21](21-final-explicit-latest.png)、[22](22-final-prose-wide.png)、[23](23-final-prose-narrow.png) | 明确返回最新与普通正文阅读 |
| [24](24-live-source-wide-final.png)、[25](25-live-source-narrow-final.png)、[26](26-live-source-close-final.png)、[27](27-live-source-resize-final.png) | 最终代码在同一真实输出中保持两条原引用 |
| [28](28-final-latest-completed.png) | 明确返回最新、自然完成与 `WEB482REPAIREND` |

11是来源访问行为的实际截图，目标为[S2-MAD / ACL Anthology](https://aclanthology.org/2025.naacl-long.475/)，页面标明 CC BY 4.0；另一来源为[arXiv 2509.11035v1](https://arxiv.org/abs/2509.11035v1)。本验收不评判论文研究结论，不归档完整文章、原工具全文或数据库。

## 检查

[最终 UI-only 正式构建](ui-build-final.log)原66600 exit0，54.45秒，使用 `--skip-tauri`；[最终类型](ui-typecheck-final.log)原51892 exit0。[语言检查](i18n.log)两语言2523键、[文档](docs.log)345操作/26组、[架构索引](architecture.log)20文档均通过。此前误跑的完整 native 构建原90279 exit0属于首轮候选，仅记录构建调用链，不能宣称最终 native 包已验收；没有发布版本、tag 或 Release。
