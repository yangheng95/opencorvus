# 用户命令原文与规范取消

[Recall、共享根因与方案](../../records/2026-10/2026-10-26-user-shell-message-and-stop.md) · [脱敏实际证据](evidence.json)

用户命令正文现在保留请求原文，包含空格、换行和Unicode。原进程、输出和进度结清后，手动停止会以同一MessageAbortedError及原取消权限写入Message和Tool；已观察输出/实际exit仍来自规范进度。原自然非零退出继续属于已完成命令。界面读取现有取消合同，没有新增UI（User Interface，用户界面）代码、假说明或第二条消息。

| 实际原图 | 人工复核 |
| --- | --- |
| [01](01-original-command-running.jpg) | User消息是真实中文命令原文，原命令执行中及输出可见 |
| [02](02-canonical-cancelled.jpg) | 点击原Stop后，工具显示Cancelled和Recorded output |
| [03](03-next-command-completed.jpg) | 下一原命令独立自然完成，中文输出及exit0保持 |
| [04](04-reopened-cancelled.jpg) | 页面重开后原取消工具/输出与Stopped参与者保持 |

四张1280×720实际视口原图均人工查看，未修改或拼接。API（Application Programming Interface，应用程序接口）发起命令，原UI停止/读取；仅重开渲染页面，不称为原生服务重启。该既有会话的实际按钮使用right_sidebar_conversation/right_sidebar.abort来源，原Message和Tool完整保持相同回执；领域测试另覆盖user/session.abort，未把不同真实来源归一成假user来源。

合格红测试1通过/2失败、10断言；当前7文件49项162断言通过。随后原文样例加强为空格/换行/中文/表情的真实命令，原3项21断言再次通过，不重复计为额外独立用例。覆盖重放、恢复、失败、原结果/事实及共享多项目取消。完整后端/触及测试类型通过；没有UI自动化。

634不复制认证，原模型投影合同返回400 ProviderModelNotFoundError，命令未启动；公开拒绝不是命令验收通过。原exec31510/native/launcher均0、提前1060054ms结清，源92表23682行及671条关键事实保持，新增模型请求0。635成对授权认证/完整模型预检可用后实际验收，4次gpt-6.1-sol流式请求全部200/EOF settled，累计215；两个直接用户命令不通过LLM（Large Language Model，大语言模型）生成。原exec97247/native/launcher均0，shutdown200，提前934216ms关闭；两个精确原命令terminal/output/settlement均结清，副本退休。原数据/12组附件保持，schema（结构）仍8，用户18571、数据库/窗口和版本发布定义未操作。
