# 303 快照游标覆盖未落盘正文的真实复现

[Recall 与共享影响调查](../return-input-plan-303.md) · [月记录](../../../records/2026-10/2026-10-11-return-input-303.md)

本轮由 root 单独完成，产品研究员仅作为被测功能。临时诊断已全部撤除，正常源码与本轮开始一致。本轮确认了真实数据缺口，公共快照契约修复仍待完成；不能将记录收尾或 Provider 正常完成解释成缺陷已修好。

## 已确认的根因

[完整输入汇总](live-02/input-chain-summary.json) 保留 9714 条连续序列、0 上传失败、0 待上传、0 冲突，所有诊断计数均未触顶。1583 次投影、1041 次目标正文 render 输入中，发现一份相同错误正文。[原始因果链](live-02/root-cause-chain.json) 的关键步骤为：

| 时间（UTC） | 原始事实 |
| --- | --- |
| 14:42:38.194 | HTTP 返回 lastLiveSequence=3363，但正文只有 4675 字符，末尾是“尤其不能只给模态背景设置 `” |
| 14:42:38.268 | live 3364/3365/3366 依次追加“宣”“称”“背景” |
| 14:42:38.272 | trace 4248 生成 4679 字符正文，漏掉原文中的 7 个字符 |
| 14:42:38.273 | trace 4249 将这份错误正文送入 Markdown owner 15 revision 3 |
| 14:42:38.311 | live 3367 完整 Part 快照补回 4686 字符，含正确的代码词 none 和后续连接文字 |

对应实现是 SessionProcessor 先累加内存正文、发布 ephemeral delta，再按 200ms 周期写完整 Part；Task Session conversation 路由采集当前 live 游标，却读取较早持久化前缀。因此游标已包含未进入 HTTP 正文的字符。界面没有收到这些片段，字符串前缀吸收无法补出缺失内容。301 处理旧完整快照覆盖，不能替代这个未落盘边界的修复。

本次 renderer 的实际帧仍保持 revision 2 的正确旧前缀，之后接受 revision 4 的补齐结果；revision 3 的错误输入没有作为已接受的 HTML 帧出现。数据缺口与错误渲染输入已被证明，不能据此宣称本次实际绘制过损坏尾部，也不能把原截图所有可见闪烁都归因于这一条链。

## 三次真实运行

- live-01：13 次真实 gpt-6.1-sol 流式请求，最终研究员正文 8168 字符。逐事件 AppLog 诊断有上传缺口；[完整性记录](live-01/diagnostic-v1-summary.json) 及 UI Copy 导出的 [客户端原始记录](live-01/diagnostic-v1-client.json.gz) 保留该失败。服务端加客户端仍缺 1291–2942，不能冒充完整观察。一次浏览器控制超时后重新绑定原 tab 61，未重启或刷新页面。[实际返回画面](live-01/02-child-returned.png) 与 [恢复后同页](live-01/03-recovered-same-page.png) 保留。
- live-02：14 次真实流式请求，最终正文 7317 字符。[操作时间](live-02/manual-ui-timeline.json)、[首次返回](live-02/02-child-returned.png)、[Dock 重开](live-02/03-dock-returned.png)、[最后来源](live-02/05-completed-sources.png) 已人工查看。小批量诊断写入现有日志接口，保留了完整输入链。W3C 首次 webfetch 连接关闭，模型使用相同 URL 成功重试；失败与成功来源均真实可见。
- live-03：诊断撤除后，正常类型检查和 50.88 秒构建完成，再用正常服务执行 13 次真实流式请求。[正常 Sources](live-03/01-normal-sources.png)、[完成后来源及悬停提示](live-03/02-normal-completed-sources.png)、[页面实际加载资源](live-03/normal-assets-observed.json) 已复核。该次是恢复正常产物的检查，不是未实施修复的通过证据。

三个 Task 的 [第一轮终态](live-01/task-complete.json)、[第二轮终态](live-02/task-complete.json)、[正常构建终态](live-03/task-complete.json) 均为各自 epoch 1 completed。原 exec [93996](live-01/original-exec-joined.json)、[42359](live-02/original-exec-joined.json)、[32835](live-03/original-exec-joined.json) 均实际 join exit 0；三组自己的页面、Host/Native 与凭据/模型副本已闭合，分别有独立 closure-readback。没有运行 UI 自动化测试。

## 原始数据与后续修复

诊断源码仅保留在 [v1 审计副本](diagnostic-v1/return-input-trace-303.ts) 与 [v2 审计副本](diagnostic-v2/return-input-trace-303.ts)，实际运行源码已删除。完整原始运行日志见 [live-01](live-01/return-input-303-live-01-runtime.log.gz)、[live-02](live-02/return-input-303-live-02-runtime.log.gz)、[live-03](live-03/return-input-303-live-03-runtime.log.gz)。文本先脱敏再无损压缩，[压缩记录](compression-receipt.json) 逐文件验证展开字节等于实际原件，并检查展开内容中的凭据；私有原件继续保留。请求文本副本仅规范化文件末尾空行。

后续必须修复快照内容与游标共同覆盖的范围，同时审计 Task 初载/重开/过期恢复、Inspector、Standalone/Mission/Side Chat、reasoning、终态/重启和多项目隔离。要以同一权威流式状态或明确同步边界保证缺失片段可恢复，禁止最长文本、延迟显示、忽略增量或只隐藏 Rendering。当前共享实现方案未完成，持续目标保持进行中。
