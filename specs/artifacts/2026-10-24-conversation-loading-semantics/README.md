# 对话加载指示器的状态与无障碍语义

对应[调查与方案](../../records/2026-10/2026-10-24-conversation-loading-semantics.md)。572由单一开发agent在自有开发服务`http://localhost:54056/ui/`实际交互、截图并逐张人工查看；没有用户界面自动化测试。用户18571实例未操作。

原问题证据来自[571记录](../../records/2026-10/2026-10-24-member-dock-loading.md)：加载完成后的辅助功能树仍显示“正在加载Task”，实际busy/active都为false，画面顶部已隐藏。根因为只用透明度隐藏命名元素，同时main另写属性；共享状态也用于Chat和Mission，原Task名称范围错误。

本次App直接把同一个现有加载标志绑定到可见状态、辅助功能暴露、加载区域的busy及关联描述；进度条为不确定进度，名称跟随当前界面语言。原main对应属性写入删除。细线位置和输入行为保持。

## 人工复核画面

| 截图 | 实际观察 |
| --- | --- |
| [01](01-task-loading.png) | 首次Task已加载完成的画面；不是加载中证据 |
| [02](02-chat-loading.png) | 英文Chat真实十二秒慢读，细线可见，辅助树命名Loading conversation |
| [03](03-chat-loaded.png) | 原Chat正文OK，区域空闲，进度条辅助投影隐藏 |
| [04](04-task-switch.png) | 实际Task conversation请求中的加载状态，细线和辅助树同步；没有人工延迟该请求 |
| [05](05-task-loaded.png) | 原Task完整正文与空闲状态 |
| [06](06-chat-loading-zh-draft.png) | 中文慢读时“正在加载对话”，仍可输入本地草稿 |
| [07](07-chat-loaded-zh-draft.png) | 正文出现后草稿保持，未发送；随后已清空 |
| [08](08-mission-loading-zh.png) | 原Mission真实十二秒慢读，名称为“正在加载对话” |
| [09](09-mission-loaded-zh.png) | 原Mission正文与既有已完成目标，区域空闲；未唤醒执行 |
| [10](10-home-after-changing-selection.png) | 原Chat加载完成后回首页，不作为加载中改选证据 |
| [11](11-home-after-leaving-pending-chat.png) | 另一次Chat仍在慢读时373毫秒内回首页，原加载状态随当前选择清除 |
| [12](12-home-goal-menu.png) | 默认页加号菜单中的持续目标入口 |
| [13](13-home-goal-form.png) | 原目标表单，焦点落在目标字段，没有创建或提交 |
| [14](14-home-goal-help.png) | 使用说明可读，明确模型、创建、预算、暂停和当前执行停止的区别 |
| [15](15-home-settled.png) | 旧Chat请求已结束、帮助关闭后仍是空闲首页，输入为空 |

## 运行与数据证据

- [evidence.json](evidence.json)：准确发布的标准Node构建、构建期间原数据库保留、真实请求时序、公共入口/原附件、进程与请求结算、模型目录清退和完整源数据比较。
- [ui-observations.json](ui-observations.json)：逐次人工交互对应的真实属性和辅助树相关行，只含观察事实；没有断言程序、浏览器fixture、快照比较或像素判定。
- 原完整90表、197241行及全部字段时间保持，目标原行差异为零，schema5保持。构建前后副本文件大小与修改时间保持；原源库/canonical/模型目录字节与修改时间保持。原PNG公开接口200/643字节与真实内容地址原件一致。
- 本轮没有复制auth，没有模型调用；模型未配置反馈是只读隔离范围的实际状态，不代表用户热认证失败。原exec67010/native/launcher均0，公开shutdown200距固定deadline611836毫秒，物理/输出/请求清理完整，复制的完整模型目录随后清退。

没有运行实体屏幕阅读器或验证语音输出，只人工核对真实辅助功能树与页面。Task未经过原board延迟钩子，已按实际conversation入口取得加载中画面；Chat和Mission的十二秒延迟有真实请求开始/结束记录。本修复不冒充成员正文Rendering闪烁的全场景根治，也不替代之前的真实模型执行验收。
