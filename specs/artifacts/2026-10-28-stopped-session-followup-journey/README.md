# 停止后续聊与历史定位证据

对应[方案](../../records/2026-10/2026-10-28-stopped-session-followup-journey.md)。单代理、真实开发CLI /ui和gpt-6.1-sol流式请求，原始截图全部人工查看，没有UI自动化测试。

- [01 原停止](01-original-stop.jpg)：原755部分正文与真实取消详情。
- [02 真实续聊](02-real-followup.jpg)：同Session新输入之后实际回复“停止后可以继续。”，旧停止说明仍属于旧回复。
- [03 重命名](03-renamed-chat.jpg)：页头和侧栏同步真实保存的新标题。
- [04 标题搜索](04-title-search.jpg)：按新标题查询到原Session，Return实际返回原会话。
- [05 截止失败](05-deadline-offline.jpg)：原756服务触发预设30分钟物理截止，离线及禁用Composer；不是正常关闭或在线通过截图。
- [06 保护实例在线读取](06-guarded-history-online.jpg)：零模型757读取同一真实历史，保留标题、原停止及实际后续回复。

[真实请求事实](followup-facts.json)保留唯一新input/assistant parentID、原停止身份、实际回复和四次200/EOF；新批6次上限，余2退休，累计759。[数据保留](data-retention.json)记录来源100281行保持、旧100276行精确相同和5行真实授权更新，最终101266行/schema9/integrity ok。[剪贴板观察](clipboard-observations.json)分别记录首次未知863字符、清空未发送草稿、第二次361字符精确原文及最后粘贴被离线拒绝，不将Copied提示当完整验收。

[原756收尾](retirement.json)明确native/launcher1、deadline_exceeded、缺少正常公开shutdown和余量；物理/输出/请求及精确身份结清后退休auth/models，源保持。[子命令结算](process-settlement.json)区分93个原handle全部结清、90个出生身份可另证、3个未捕获，保留15个anonymous目录git查询的真实128。

本任务的[提前正常关闭工具](owned-ui-shutdown.ts)仅为精确当前进程和loopback CLI注册一次公开关闭，不进入产品执行/模型决策逻辑。[真实757正向验收](graceful-shutdown-verification.json)保存原计划、dueAt+5ms触发、公开200、原exec/native/launcher0及物理/输出/请求结清，506751ms余量；模型0、catalog已退休，原101266行全部保持，最终101268行/schema9。[文档检查](docs-check.json)通过351操作/26组。

本批没有产品生产代码、数据库格式、版本或发布变化。756正常关闭、首次复制原因、最终实际粘贴和中文跟进原图未达成；757独立通过不能替代原失败结果。
