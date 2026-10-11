# 313 子会话终态内容合并

[Recall、根因与横向审计](../source-settlement-plan-313.md)。2026-10-12，单开发 agent。

## 修复

共享子会话投影此前会把保留的实时 Info、完整 Part 或文字字段无条件覆盖到新的持久化补全上。现在遵守后端不可变边界：已完成助手的 Info 和普通 Part 使用已确认的值，退休没有进入完成记录的文字/工具输入草稿；已持久化 completed/error 工具结果保留真实终态。已有工具请求仍可在助手完成后结算，实际删除与后到 compaction checkpoint 保留。活动正文继续使用实时完整字段，没有按文字长度、请求时刻或总序号猜测新旧。

没有修改 host 调度、工具选择、API（Application Programming Interface，应用程序接口）、持久化节奏或恢复策略。Task、Mission/Session、普通Side共享的投影函数是唯一实现；主会话 tree-writer 和普通Side连接快照原有归属保持。完整影响分析涵盖自然终态、错误/取消、活动数据、目标/authority切换及独立工具结果。

## 实际值重放

`actual-child-http.json` 是当前服务读取真实305子会话的HTTP结果。`before-projection.json` 将其中已完成的84字符正文与305实际wire记录的85字符值交给当前纯投影函数，旧输出为85字符，重新带入自然text-end已裁掉的换行。`after-projection.json` 在同一真实输入下输出84字符，与完成正文一致。

这是保留实时值遇到完成补全的数据重放，不是浏览器注入，也不是声称自然捕获了丢失最后一帧。它证明这个覆盖契约的错误与修正；不能单独证明原始Rendering闪烁的完整原因。

## 真实子侧栏

原305已完成 Task `tsk_g00VXl5hD700hVMdFR1S` / 子Session `ses_hgSPfO9OQZwmT76Ty57I` 经过新的原进程身份、当前schema（数据结构）、所有Project配置和恢复前沿资格检查，再完整复制runtime和90张表。没有带入auth/models，没有创建新Task或成员，没有模型请求。

正常开发服务 `http://localhost:18282/ui`、新构建 main-BU22a7ik.js、自己的页82，实际打开 SubagentConversationPanel，阅读三条来源及18节正文/末尾参考，再返回成员列表并重开Dock。

- `history-01/01-child-sources.png` 是第一次截图，自动跟随后实际位于文章末尾的参考部分，文件名不代表顶部。
- `history-01/02-child-source-top.png` 显示返回顶部后的真实三条Sources。
- `history-01/03-child-sources-return.png` 与 `04-child-dock-reopened.png` 是浏览器直接截取右侧栏区域，实际呈现并人工查看；没有编辑像素或截图断言。

主区域因本轮刻意无Provider配对显示模型配置不可用，历史阅读仍正常；这不是新的Provider验收。静态历史页面不能代替当前Research Studio新的流式/丢帧场景。

## 检查与收尾

35项聚焦service（服务）数据契约通过，覆盖终态正文/Info、失败和取消、草稿退休、后到工具结果、终态工具、删除/checkpoint、活动增量、Task/Mission/Chat路由及authority隔离。另1项真实后端Tool fact storage测试通过，验证助手先完成、工具后结算与正文不可变，共36项、89个断言；没有运行UI自动化测试。

Overlay类型检查原执行器62911实际exit0；构建13872实际exit0，52.86秒，renderer public surface通过。公开build.log只裁去行尾空格，原件保留。当前文档/架构检查另行完成。既有大chunk提示仍在。

自己的页82已关闭，原history执行器77393实际exit0；Native63704/Host22804出生身份、物理/输出/请求结束、18282端口及凭据缺席已独立回读。19组受保护表、生命周期和配置与原件完整逐行相同；两个Project文件清单只有第一个Project的.git目录修改时间变化，无新增/删除项或文件元数据变化，这不是文件字节完整性的证明。五个本轮Native生成文件在所有观察器结束后按出生事实保管。完整运行日志脱敏gzip保存，展开恢复相同字节；原件保留。

本轮修复的是持久化终态内容被旧实时投影覆盖。活动checkpoint与live的精确先后、漏接删除后的旧Live消息保留、以及原Research Studio全部Rendering行为仍需继续调查；不将终态规则扩大为所有恢复/闪烁问题已解决。持续goal保持active。
