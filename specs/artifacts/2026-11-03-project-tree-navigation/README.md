# 项目侧栏折叠与打开验收

本轮在隔离原生开发页面38669/38670进行真实操作、截图与人工复核。[规格](../../records/2026-11/2026-11-03-project-tree-navigation.md)记录根因与实施决定，[实际验收记录](qualification.json)记录运行、原数据和目标保全。

项目箭头现在只展开/收起分组，名称通过原动作打开项目；菜单取消、置顶迁移和项目定位的焦点归还名称按钮。原问题是折叠意外切页；原稿始终由其原会话保存，本轮没有把切换后的空输入框误说成数据丢失。

| 截图 | 人工查看结果 |
| --- | --- |
| [01](01-before-current-conversation.jpg)、[02](02-before-collapse-navigates.jpg)、[03](03-before-returned-draft.jpg) | 修改前：另一项目“收起”使当前对话变为项目Home；正常返回后草稿完整。 |
| [04](04-after-other-project-collapse-en.jpg)、[05](05-after-keyboard-current-collapse-en.jpg) | 修改后：鼠标、Enter和Space仅改变分组，当前对话/草稿保持。 |
| [06](06-after-locate-conversation-en.jpg) | 定位展开原项目并聚焦实际会话行。 |
| [07](07-after-name-opens-project-en.jpg)、[08](08-after-project-home-settled-en.jpg) | 名称打开目标Home；07为初到、权限仍读取中，08才是稳定首页。 |
| [09](09-after-rename-cancel-focus-en.jpg) | 取消重命名后名称焦点可见，当前对话/原稿保留。 |
| [10](10-after-pin-focus-en.jpg)、[11](11-after-unpin-focus-en.jpg) | 本轮新QA项目置顶及取消置顶跨分区后均聚焦名称。 |
| [12](12-one-list-disclosure-en.jpg)、[13](13-one-list-project-locate-en.jpg) | 单列表中置顶组仍有独立箭头/名称，项目Home定位聚焦名称。 |
| [14](14-one-list-empty-unpin-en.jpg) | 取消置顶空项目后，按原合同归还组织方式按钮；空项目仍存在，没有创建假会话。 |
| [15](15-project-locate-focus-zh.jpg) | 中文键盘定位项目名称。 |
| [16](16-disclosure-preserves-draft-zh.jpg) | 中文鼠标和键盘折叠保持同一对话、完整草稿。 |
| [17](17-name-and-cancel-focus-zh.jpg)、[18](18-returned-conversation-draft-zh.jpg) | 中文名称打开Office，取消重命名归还其名称；完整往返后原稿保持。 |

0新增模型请求，累计1319；未在真实模型执行中增加折叠场景，也没有运行UI自动化。四公共检查点15 Mission、4 Task全状态及根会话、24 Mailbox及查询、原完整Goal（complete/345102/1轮、会话idle）保持，12次真实原文件读取合同保持。原业务行、源库、103/104原项目文件与Git和265附件/元数据文件保持；数量含915新增JSON记录与元数据，不沿用上轮原263保护数。

两实例公开关闭200、原句柄0并完成物理/输出/请求结清，四配对认证/完整模型目录副本退休。所有Pin/Unpin只针对本轮新QA项目，旧项目重命名仅取消；验收文字未发送并已清除。没有操作用户现用窗口、真实用户数据库或发布。
