# 对话与项目入口语言实页证据

本人单agent在后台隔离开发服务`/ui/`手工操作并逐张查看截图。三个实例分别38744/38745/38746，标签305/306/307均已关闭。没有操作用户18571、现用窗口/进程或用户数据库，没有新增或运行UI自动化。原936/927等历史来自真实原库，不新造消息/响应、修改原文或发送模型请求。

| 原图 | 实际结果 |
| --- | --- |
| [01](01-before-project-chat-label-and-work-draft.png) | 原项目“＋”进入该项目工作草稿；真实无障碍名“为此项目新建 Chat”。原生title没有出现在截图，不把它当作可见提示。 |
| [02](02-before-project-plus-keyboard-focus.png) | 从项目操作按钮Tab到“＋”，只有焦点圈，没有应用内可见用途说明。 |
| [03](03-before-global-new-chat-technical-tooltip.png) | 顶部新对话进入全局主页，原提示混用Chat/Task并解释下级编排。 |
| [04](04-before-start-from-scratch-technical-tooltip.png) | 创建菜单“从头开始”聚焦，原应用Tooltip混用Chat并提前描述匿名项目。 |
| [05](05-before-code-conversation-placeholder.png) | 全局草稿正常选择编程用途，原输入提示混用Chat。 |
| [06](06-after-english-project-keyboard-tooltip.png) | 首次候选Tab到“＋”，真实显示“Start work in this project”，原项目上下文保持。 |
| [07](07-after-english-project-keyboard-activation.png) | Escape已关闭提示，回车激活仍进入同一原项目草稿并聚焦输入框。 |
| [08](08-after-english-global-new-conversation.png) | 英文新对话只解释开始对话、描述要做的工作。 |
| [09](09-after-english-project-creation-timing.png) | 英文创建菜单说明发送消息时创建临时项目，也可先选文件夹；内容在现有提示内正常换行。 |
| [10](10-after-chinese-project-keyboard-tooltip.png) | 同页切中文后Tab聚焦“＋”，显示“在此项目中开始工作”。 |
| [11](11-after-chinese-project-keyboard-activation.png) | 中文Escape/回车后原项目草稿与输入焦点保持，未新增会话。 |
| [12](12-after-chinese-global-new-conversation.png) | 中文新对话提示为“开始一段新对话，直接描述要完成的工作。”。 |
| [13](13-after-chinese-project-creation-timing.png) | 中文“从头开始”解释实际创建时机与先选文件夹，未改变菜单动作。 |
| [14](14-after-chinese-code-conversation-placeholder.png) | 首次候选的编程输入提示已经中文；人工复核发现同页“改 Bug”仍混用英文，保留真实中间结果。 |
| [15](15-intermediate-home-suggestion-still-mixes-english.png) | 实际点击旧建议，仅填入未发送草稿，但草稿也含Bug，证实第二处同源产品文案。随后已由本人清空。 |
| [16](16-final-chinese-code-home-and-problem-action.png) | 最终新构建页面的编程提示和“修复问题”按钮均为中文；设置悬浮提示是实际页面状态。 |
| [17](17-final-problem-action-fills-chinese-editable-draft.png) | 实际点击“修复问题”，正常填入“调查并修复这个项目中的程序问题，然后补充回归测试。”，输入框仍可编辑，未发送。 |
| [18](18-final-chinese-project-keyboard-tooltip.png) | 最终构建再次实际Tab聚焦原项目“＋”，显示正确中文范围；随后Escape/回车也正常。 |
| [19](19-final-chinese-code-home-after-reload.png) | 经正常新对话→编程选择，再仅刷新本人页面，中文按钮/输入提示保持。 |
| [20](20-final-original-eight-file-review.png) | 原八文件、56新增/0删除、8/8及第一份原比较保持。 |
| [21](21-final-original-four-question-answer-history.png) | 关闭审阅、主对话上滚一页，原4个问题与四项真实回答完整可见。 |

项目按钮复用现有Tooltip.Root/Trigger/Portal/Content，替代唯一原生title；按钮样式、disabled、aria-label、数据身份、唯一动作、项目范围和焦点回归保持，没有额外状态或新延时配置。[Kobalte官方合同](https://kobalte.dev/docs/core/components/tooltip/)说明聚焦/悬浮及Escape/激活关闭行为；本轮真正复核的是键盘聚焦、Escape、回车，项目按钮纯鼠标悬浮没有单独截图，不扩大声称。

修复8个中文键/3个英文键。中文两个标题键同步本地化，但当前全局草稿没有owner，其ContinuousGoalControl标题分支未实际渲染，不宣称已视觉验收。错误project.new_chat_missing_directory、其他Mission/Task文案、技术标识、品牌和历史用户/模型原文保持，本轮不宣称全产品英文已清零。首次候选06—15与最终16—21明确分开，英文入口场景在首次候选真实呈现，最终两项补充仅改中文建议标签/草稿，没有再次呈现最终英文页。

两次普通Node构建的主脚本名相同，语言JSON是独立资源；没有以脚本名或源码摘要替代验收。最终原生服务语言资源真实返回200和Cache-Control: no-cache；16/17的新按钮/真实草稿及19刷新才是最终中文呈现证据。没有声称正在打开的其他用户页面会自动换语言内容。

当前8包类型检查、两次普通Node构建、当前文档/架构/接口检查通过；原九项业务三阶段初始/结束共54次，原936/939与940两轮历史正向核对4/4/8次。无本轮模型执行验收，0请求、累计1440。全部原生服务公开关闭200/原始句柄exit0/物理输出请求结清，6份认证/完整模型目录副本成对退役。最终逐行及文件保全见[资格记录](qualification.json)。
