# 首页草稿与 Goal 的真实衔接

2026-10-20，单agent；[调查、方案和结果](../../records/2026-10/2026-10-20-goal-composer-draft.md)。16张实际1280×720内置浏览器截图，均已人工查看；没有UI自动化。

- 修改前：[首页已有文字](before-home-draft.png)、[空白目标表单](before-blank-form.png)、[取消后新会话也为空](before-cancel-empty.png)。原草稿留在旧scope，结论是输入衔接中断，不是数据库删除。
- 项目入口：[预填](after-project-prefill.png)、[取消后保留](after-project-cancel.png)、[同会话reload恢复](after-project-reload.png)。
- 用户确认值：[编辑后创建](after-edited-goal-created.png)、[真实自动执行](after-edited-goal-run.png)、[operator完成](after-edited-goal-complete.png)。原纯文字草稿在成功创建后被消费；真实gpt-6.1-sol流式回复DRAFT461READY，1/1轮、38,356令牌。
- 实际引用：[英文说明](after-quote-pending-form-en.png)、[另一个Goal创建后仍保留引用和待发送文字](after-pending-quote-retained.png)、[中文说明](after-quote-pending-form-zh.png)。第二个真实流式目标返回QUOTE461READY，1/1轮、38,534令牌，随后operator明确完成；没有把pending引用制造为用户消息。
- 全局入口：[中文预填](after-global-prefill-zh.png)、[取消后保留](after-global-cancel-zh.png)。侧聊：[自己的预填](after-sidechat-prefill-zh.png)、[主会话和侧聊分别保留](after-sidechat-cancel-zh.png)。
- [正式前端构建](build.log)、[完整结果](results.json)、[真实持久化/Provider事实](manual-ui-facts.json)、[数据保留](history-verification.json)：schema2、113 Project/155 Session，110/149及111/151两个基线全部身份、归属、目录保留。首次采集误按Message ID排序，核对MessageStore后改为time_created/id，重跑成功；不是产品排序异常。
- [修改前服务结算](goal-composer-draft-461-settlement.json)、[新构建服务结算](goal-composer-draft-461-final-settlement.json)、[授权复制对退休](private-pair-retirement.json)：两个公开shutdown200，原25799/52653均exit0，物理/输出/请求/launcher结算；实际秘密扫描通过，完整models与auth复制对退休，源文件未写入/刷新。

明确未达：真实文件/目录上传与待发送附件移交尚未获得视觉验收；本轮pending上下文实际覆盖引用，不能据此宣称文件路径通过。Task/Mission表单的草稿接入沿用primary精确key，但本轮没有分别创建新的Task/Mission做视觉验收。完整历史配置保存10s/恢复5s原性能目标仍未达。这里也不是Sources/侧栏Rendering的新流式验收。用户18571页面/进程及真实用户数据库未操作。
