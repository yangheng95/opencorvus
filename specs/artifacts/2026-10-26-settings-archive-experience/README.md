# 设置与归档实际体验

[方案与根因](../../records/2026-10/2026-10-26-settings-archive-experience.md) · [脱敏运行证据](evidence.json)

修复模型不可用时 Chat/Work、Task、Mission 归档/恢复被完整执行初始化拦截的问题。唯一分类补充两条精确的 Project identity 模式；原取消、物理结算、关闭、权限及保留历史的事务不变。

| 原始实图 | 实际人工复核 |
| --- | --- |
| [01](01-general-baseline.jpg) | 当前通用设置、搜索与返回 |
| [02](02-archive-mutation-failed.jpg) | 修改前实际归档400后列表仍空，原会话保持 |
| [03](03-archived-work-visible.jpg)、[04](04-work-search-matches-original.jpg) | 修后真实归档记录进入列表，Work类型搜索匹配原会话 |
| [05](05-chinese-archive-before-restore.jpg)、[06](06-restored-query-and-focus.jpg) | 中文归档日期/身份，实际恢复后查询和焦点保留 |
| [07](07-restored-original-history.jpg) | 重新打开原会话，原回复、已完成Goal及36950/1用量保持 |

13项后端正向合同、29断言通过；4个完整Server入口覆盖原Prompt取消、Task终态、Mission及实际子Task关闭、恢复与跨Project边界。backend与当前新测试扩展类型检查均0。无UI源码改动，复用未变的普通Node冻结构建main-BgjVdyol.js，无UI自动化测试。截图为实际1119px左侧捕获，右端图标不在图内；对应恢复动作通过真实点击、列表结果和公开会话读回确认，不宣称右侧像素验收。

620/621均公开shutdown200，原exec94760/86633、native/launcher均0，物理/输出/请求结清；提前975014/892512ms关闭，自建标签均关闭。每次源92表9541行逐行保持，目标原9类278条事实保留；621只允许实际原会话归档/恢复的活动时间更新，其他原字段和协议历史保持。无认证副本、新增模型请求0，累计仍167；未操作用户数据库或服务。

独立Stop/abort/cancel的模型准入线索保留为下一批，不以归档通过宣称全部功能完成。原工具链/夹具/响应字段错误与原生代理探测警告资格详见证据。
