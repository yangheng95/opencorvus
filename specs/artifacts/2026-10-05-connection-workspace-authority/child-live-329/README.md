# 329 来源展开期间真实正文持续生成

对应[Recall 方案](../child-live-plan-329.md)。当前主交付 `2b6735ff2d77f7eab082ad4df3603a346d0d7ab2`，开发、浏览器操作及截图复核由 root 单独完成。本轮没有生产代码修改；通过提前打开页面，补齐 328 缺失的实际生成期间观察。

## 真实过程与人工结论

先打开 fresh 开发服务 `http://localhost:18300/ui/`，再用真实 CLI 创建 Task `tsk_g00VXnHXUY002nUsxVFT`。只运行产品中的一个只读研究员，真实调用 search_code、read、read_agent_message、两次 webfetch；没有界面状态注入、伪造消息或开发子 agent。read 实际读取同一个授权输入全文，因此比 328 多一条整文件 Source，共六条来源；没有为了固定测试数量删除这条真实数据。

下表时间为 UTC；本地上海时间加 8 小时。正文起止来自真实 Text Part 的持久化时间，[规范数据](live-01/canonical-current-conversations.json)和[公开事件流](live-source-observation.json.gz)可核对。页面几何仅为手动观察时的只读记录，未编写自动 UI 断言。

| 实际动作/阶段 | 时间 | 可观察事实 |
| --- | --- | --- |
| 展开三条文件命中来源 | 01:19:27.387 | [03](screenshots/03-expanded-before-prose.png)，长正文尚未出现 |
| 第一组正文实际生成 | 01:19:29.433–01:20:08.405 | 1963 字符，期间查看[04](screenshots/04-first-prose-growth.png)和[05](screenshots/05-before-close-streaming.png) |
| 主动阅读来源后关闭侧栏 | 01:20:01.065 起 | scrollTop=129.3333282470703；当时 scrollHeight=2149 |
| 第二组正文实际生成 | 01:20:14.631–01:20:51.125 | 2077 字符；[06 重开](screenshots/06-reopened-streaming.png)在 01:20:19，[07](screenshots/07-later-growth-same-sources.png)在 01:20:40 |
| 第三组正文实际生成 | 01:20:56.711–01:21:44.402 | 2785 字符；01:21:05 从[成员列表](screenshots/08-agent-list-during-stream.png)[返回](screenshots/09-return-from-agent-list.png) |
| 实际查看正在增长的正文尾部 | 01:21:16 起 | [10](screenshots/10-growing-tail.png)到[11](screenshots/11-growing-tail-later.png)，第 11、12 节先后进入页面 |
| Task 终态后来源阅读 | 01:22:46.666 | [13](screenshots/13-task-terminal.png)，同一来源展开、scrollTop=129.3333282470703，scrollHeight=7325 |

人工查看全部 13 张截图：来源 2/3/4 行展开后，在正文增长、关闭重开、返回成员列表再进入时保持展开与阅读位置；可见正文没有在这些观察帧退回 Rendering。正文尾部两张画面呈现自然追加内容，回到来源区仍可读。**这些是明确时段的交互和观察帧证据，不是逐帧录像，也不能据此宣称所有复杂历史会话均无闪烁。** 本轮未发现新可复现产品缺陷，不添加无依据缓存或隐藏占位符。

01 保留研究员派发前画面，02 为研究员启动早期；12 是最后正文结束附近手动上翻回来源的画面。该帧 Task 短暂显示 Not running；随后负责人实际恢复、读取证据并完成 Task。没有把该标签单独当作调度根因或 Task 终态，最终判断依据真实 lifecycle、请求和物理所有者事实。

## 后端、验收和收敛

[实际后端核对](actual-backend-verification.json)：Task 244682ms 完成；17 次实际 gpt-6.1-sol 流式请求均终止于 EOF，预检分别确认凭据可用、完整模型目录投影和实际模型一致。研究员四段正文为 68/1963/2077/2785 字符，共 6893 字符；另有两条仅工具消息。六个实际流式正文最终值按既有终态 trimEnd 契约对应规范存储。负责人通过原有消息和工具证据读取完整交付，没有让研究员合并重写。

事件观察器收到 5053 个事件，实际传输 635155 字节，解压 18585053 字节。完整对照见[正文和读取事实](observed-stream-and-narration-reads.json)。六条 Source 均有实际事件和规范存储对应。数据核对只覆盖真实后端契约，不充当 UI 或性能测试。

Task 使用真实 openedAt 起 900000ms 固定上限及 180 秒无真实活动检查，未续租或另建 Task。原启动句柄 5414、事件观察器 72855、关闭及归档命令均 actual exit0。自己创建的 IAB 页面 107 已关闭，Native 76068、Host 61472、18300 端口、输出和请求链全部完成，复制的 auth/models 成对清理，见[物理终态](live-01/child-live-329-live-01-physical-terminal-and-pair-cleanup.json)。周期所有者收据按原文件名和原文本完整压缩归档，私有原件保留；不是丢弃过程证据。

本轮没有 UI 自动化测试、DOM/组件断言或截图基线，没有生产变更，因此没有重复构建。后端事实校验、docs:check 及正常提交/推送钩子分别验证对应范围。[人工观察时点](manual-dom-observations.json)只能辅助截图和 Part 时间核对。

## 后续

Sources 基础显示和本轮连续生成场景已有真实证据，下一批转向更长历史会话及功能中的实际问题，不机械重复相同短会话。goal 保持 active；若再出现闪烁，按实际会话 owner、Source 插入顺序和渲染请求时序定位后修复，禁止把当前有限观察当作全局根因证明。
