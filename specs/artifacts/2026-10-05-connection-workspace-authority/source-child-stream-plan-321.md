# 321 真实子侧栏持续输出验收

## Recall

用户要求持续自主迭代，重点Sources和子侧栏反复Rendering，明确单agent开发。320已实际提交并推送9f5ac34ec27796007cddc1e82ed86e7074e9a836，本轮开始git status干净，前轮为progress。持续goal active，旧目标中的多个Astra开发子agent不执行。

313–317修复了子会话canonical/live内容和成员关系收敛，但此前页面主要为305真实任务历史和普通Side chat。318–320实际完成搜索来源、行号跳转、长目录说明；不能用这些普通会话样本替代SubagentConversationPanel的完整流式资格。本轮回到真正的产品Task及其子会话。本开发任务仍由一个agent完成；被测产品按305已验证入口只运行一名只读Researcher，由产品Task owner正常调度与收尾，不安排并行开发或额外测试成员。

已读320 Recall、305真实Task请求/调度/完成/Provider证据、305 CLI创建和公开SSE观察器、Base README与Researcher权限、当前SubagentConversationPanel完整resource/live/refetch/display逻辑、CardParts/SourceParts/TextPart及当前07-panel。305实际dispatch_agent→base-researcher→三次webfetch→read_agent_message→manage_task完成路径已验证。工具名与最后状态只是线索，新的行为必须由本轮真实输入、事件、持久化事实和页面证明。

## 现象、候选原因和范围

原始截图有正文附近反复Rendering和大量Sources折叠行。当前TextPart只在尚无已渲染块且pending时显示加载状态；Source分组为chronological runs。子面板按观察时序合并resource读取与live事件，完整字段和Source都走真实流。旧采样没覆盖新代码下真正子会话的持续来源插入与补全，原问题状态仍未知；不据此先改代码或移除加载提示。

本轮的唯一输入是一条真实只读Task：产品Researcher按普通可见消息输出开场、搜索隔离项目指定文件、继续长正文、读取一篇明确公开网页、再继续长正文。观察首段、来源插入、后段持续输出以及完成/重开期间的内容和读位。Source生产、worker正文、Task归属均使用现有真实入口，不注入消息、不造浏览器fixture、不用DOM或截图断言。

如果出现排队、恢复、并发或终态异常，立即横审共享Task/Mission/Session执行轮次、生产入口、正常/终态、重试重启和多项目隔离；不能因一名Researcher案例就归为局部。若真实复现显示重建或数据回退，先补齐调用/数据/协议/测试/文档影响再修；否则仅记录实际覆盖与未知边界。

## 验收设计

使用正常开发/ui18291和当前320构建，fresh Task资格Native launcher，20个累计Provider请求，180秒活动观察与Task实际openedAt起900000ms边界，原生最大边界独立保留。授权auth及完整models成对，分别验证usable/projected/实际gpt-6.1-sol流式；CLI task create也使用私有官方Bun1.4.0，读取原创建收据而非超时重建。

启动后只创建本轮隔离项目的source-review.md，内容为人工编写的普通验收输入。真实CLI提交请求，保存requestID/acceptance和Task selection，再打开/ui手动进入该任务唯一Researcher侧栏。采样截图并人工看图，展开真实Sources、暂停跟随查看来源、查看后段持续增长、结束后关闭/重开Dock。只读DOM排布用于辅助描述，不替代视觉验收，也不宣称少数截图覆盖每一帧。

公开Task事件流观察器记录真实文本完整值、分片、Source更新与终态，终止后与实际数据库比较，明确区分流末尾规范化和遗漏。它只观察API（Application Programming Interface，应用程序接口），不是UI自动化。源文件和网页均为明确测试输入，模型工作成果完整可见，不发布额外产物或读其他凭据/用户目录。

必须获得Task完成事实、Provider读流完成、原启动/观察器执行器actual join、自己页面关闭、精确Native/Host/端口及配对副本清理。长运行以活动收据和定时观察推进，不持续追日志。非简单修复按计划实施并验证；仅观察轮也保存改变判断的证据。文档/根/月索引同步、范围提交、fetch/merge、完整待推送集合检查、正常push，goal保持active。

## 本轮观察改变的下一步

首轮420+2988+3507字符及四个Sources真实产生，两个流式样本未观察到Rendering回退；来源成功展开时已完成，因此不宣称流式展开/停留资格。Task实际完成但负责人因read_agent_message仅暴露最终Message正文、早段只有Tool证据入口，要求同一Researcher续轮重写7097字符。已读取完整相关定义/执行器并核对实际失败、修正请求及原始Message parentID，不把模型自述或UI错误标题当根因。下轮需先全仓检索读取契约、调用方和历史决策，扩展有界可见正文能力，保留终态anchor与Task/项目/occurrence边界；不能通过放开任意Message、旁路或强制一次final写全文处理。

初次CLI隔离参数不完整，补齐后按同requestID恢复原创建；原失败保留。原观察器71983和启动96449均实际exit0，15次Provider流200/EOF，页91/Native73236/Host73016/端口/配对副本已关闭。[完整证据与未满足项](source-child-stream-321/README.md)。当前无生产修改，继续文档检查、范围提交及正常push，再优先修复实际读取缺口，goal active。
