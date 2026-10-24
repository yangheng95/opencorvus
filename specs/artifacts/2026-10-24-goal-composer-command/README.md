# 持续目标的输入命令

对应[方案与调查](../../records/2026-10/2026-10-24-goal-composer-command.md)。575单agent执行，沿用户明确的命令/加号入口选择，保留默认首页composer和普通starter布局。主输入及SideChat输入`/goal`，可在其后写目标，提交只打开原表单；显式确认后才启动。原加号菜单显示`/goal`提示，帮助及动作名称覆盖中英文。

## 人工实页与实图

最初自有服务54059呈现第一构建，实图[01](01-home.png)、[02](02-menu-command-hint.png)、[03](03-command-form-en.png)、[04](04-command-help-en.png)、[05](05-cancel-retains-draft.png)证明默认布局、英文菜单、命令多行预填、帮助和取消草稿。实际canonical计数在打开前后相同，模型仍为两次已结束预检，没有因命令而创建会话/消息/Goal。随后无参数命令通过按钮打开并关闭时，真实辅助树焦点落到页面根部；该精确失败没有截图，不把前五图当最终焦点通过。

修复在命令消费后把焦点交回同一输入框，再打开原Dialog。最终Node构建main-CPAfMIiv.js在独立54060服务真实交付，十张最终实图均手动查看：

| 实图 | 人工观察 |
| --- | --- |
| [06](06-final-empty-form.png) | 空命令通过按钮打开，目标字段聚焦 |
| [07](07-final-focus-restored.png) | 关闭后焦点恢复原输入框，原辅助树输入139 |
| [08](08-final-menu-zh.png) | 中文加号入口及技术命令，模型明确为GPT-6.1 Sol |
| [09](09-final-command-form-zh.png) | 中文命令预填原目标表单 |
| [10](10-final-help-zh.png) | 命令/加号、实际确认按钮与预算说明一致 |
| [11](11-bounded-confirmation.png) | 真实Goal显式确认，自动轮次预算2 |
| [12](12-live-goal-result.png) | 真实助手标记与当前Goal完成的单次许可 |
| [13](13-goal-completed.png) | 真实正文GOAL575READY，目标已完成 |
| [14](14-side-command-form.png) | SideChat命令预填，归属“侧聊1”独立可见 |
| [15](15-side-cancel-retains.png) | 关闭后Side草稿保持，原辅助树输入204聚焦 |

[evidence.json](evidence.json)包含真实公共接口、生产parser、SQLite原助手文本/Goal事实、两个scope的原请求与进程结算；[ui-observations.json](ui-observations.json)区分初始与最终构建的人工观察，没有DOM/组件/截图自动化断言。实际Goal只接收1/2轮，助手正文标记与持久行精确相同，原Goal API状态complete、原创建/更新事件对应。Side只打开/取消，未确认新Goal；普通/近似命令保持message输出，旧/side语法由4项纯解析器正向测试覆盖。

## 结算与资格边界

原静态资源在native启动时冻结。一次同进程静态替换的真实入口检查失败，未刷新冒充新代码；先正常关闭初始scope后，再以已经完成的最终构建启动独立scope。本批总预算16、实际7次gpt-6.1-sol流式200，全部原reader EOF。原exec63280与74833均join退出0，两个native/launcher退出0，公开shutdown200分别预留753875/372880毫秒，物理/输出/请求与出生链完整；两套auth/models副本退休，源认证元数据和完整模型原件保持。用户18571未操作。

初始完整90表201153原行、最终90表201588原行的源字段时间/schema5/canonical/源文件大小mtime保持，目标原转录/Source事实保持；两个scope各仅两条容量租约槽位有意更新，没有迁移或清空数据库。原PNG公开读取200/643字节，与不可变原件一致。两个正式Node构建53.73秒与51.05秒通过，副本SQLite文件大小mtime保持；类型、2语言2536键、样式及4解析器测试通过。

未重新验证输入法、带附件/引用的命令、执行中Side发送或完整旧/side链路；没有用户界面自动化测试。初次私有构建帮助脚本因PowerShell引号错误未执行，改为保存Node脚本后完成；旧资源发布失败如实保留。Rendering根因仍未证实，本轮交付仅涵盖入口能力与实证焦点修复。
