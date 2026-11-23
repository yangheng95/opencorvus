# 专家团配置说明明确安装范围

## Recall

- 用户要求本人独立持续迭代。每批在实现前完成实际体验、根因及影响和规格落盘，随后真实桌面交互、实拍复核、聚焦正向检查、范围提交、合并上游并普通推送。第 440 批 `088ff568c` 已推送，本地与上游 0/0。此批只说明实际配置归属，中英文都验收，不使用模型或真实密钥，不改专家团激活或发布。
- 已读 `AGENTS.md`、[扩展架构](../../current/architecture/04-extensions.md) 的精确安装配置身份、[界面架构](../../current/architecture/07-panel.md)、[详情和焦点](2026-11-09-installed-expert-squad-detail-focus.md)、`ExpertSquadPanel` 的详情概览与 `ConfigurationEditor`、双语文案键、精确详情表面、读写配置客户端、`packageConfiguration`、`ExpertSquadConfigurationStore`、安装注册表和 `expert-selected-read-identity.test.ts`。全仓检索三个文案键、`loadExpertSquadConfiguration`、`ExpertSquadConfigurationResponseSchema`、`storageKey`、公开 `/expert-squad/configuration` 和表单相关实现。其余市场、恢复和发布文案独立。触及路径未发现界面自动化测试。

## 根因和影响

1. 真实隔离基线 `40688/ui/` 加载 `main-BPNhXC_i.js`。两个自有项目都装有 `scope-review/installation-review`，另有共同可见的用户级 `scope-review/shared-review`。通过正式配置写入接口仅写入三条非秘密的文本标记，再从两个真实项目分别读取项目级和用户级配置及相应详情。两个项目 ID（标识）不同，同名项目包分别返回 `Scope review north`、`Scope review south`；同一用户级安装从两个项目均返回 `Scope review shared`。密钥型字段只声明形态，始终未填写。
2. 桌面英文概览把配置写成独立于选择的 `user-global` 和 `exact manifest ID`；项目级和用户级配置表单使用完全相同的 `These user-global values are keyed by the exact manifest ID` 前缀。实际同名项目包不会共享值，用户级共享的是同一物理安装。中文表单使用「精确 manifest ID」，不带字段的 Research Studio 使用「此 package」和同样的清单措辞；这是产品文案，与包作者提供的标签不同。 [实拍](../../artifacts/2026-11-23-expert-squad-configuration-scope-copy/README.md)
3. `packageConfiguration` 从当前项目和安装来源解析声明，配置存储键由安装范围、项目 ID（用户级用全局标记）、命名空间和清单 ID 组成。数据文件位于应用的用户数据区，存放位置并不等于跨项目共享。表单收到服务端给出的 `installationScope`，现有描述未按它呈现；概览的说明也把存放位置与生效范围混在一起。先前修复确切安装读取和项目隔离，留存的泛称掩盖了已正确生效的独立配置。
4. 影响限已安装专家团详情的概览、配置表单说明和空状态。包原名、字段标签和字段数据、清单、配置存储键、权限、公开协议、密钥读写约束、调度／重试／生命周期和发布均不涉及。当前真实读写成功且项目隔离，无执行轮次、队列、唤醒、恢复或并发异常。

## 方案和验收

- 概览说明项目默认和会话选择的作用，配置值归当前安装。表单从真实配置响应的安装范围选择简短的项目级或用户级说明，紧接共用的受信工具及密钥状态说明。无字段面只保留明确的已本地化空状态标题，去掉重复说明。包原始标识、字段标签和值继续显示作者或用户原文。复用现有控件、布局和读写路径。
- 在真正开发页面复核英文项目级、用户级配置和概览，实际切换到第二项目并核对相同清单下不同标记与共享安装的同一标记；中文窄桌面核对项目级说明、用户级说明及无配置字段的内置项。在隔离数据用同一表单保存非秘密文本标记，复核其正式响应与两个项目间的实际隔离，再恢复初始标记。运行已有精确读取正向测试和界面构建、语言、样式、文档检查；比对隔离数据，正常关停服务并按完整待推送范围提交合并及推送。

## 结果

- 候选 `40690/ui/` 实际加载 `main-DPTJXWKT.js`。英文概览区分选择与配置，英文项目级和用户级表单显示各自的适用范围。实际切到南项目，在中文 160% 和 710 像素设置栏纵向滚动，说明、原作者字段和原值可读。用户级安装在北、南项目显示相同标记，南项目同名项目包显示其独有值；Research Studio 概览后的配置仅显示一句中文无字段提示。本人复核 14 张截图。 [实拍](../../artifacts/2026-11-23-expert-squad-configuration-scope-copy/README.md)
- 通过真实表单保存 `Scope review north via form`，成功反馈可见，正式接口确认只更改北项目记录，南项目记录及两处用户级读取仍对应初始值。随后键盘恢复北项目原标记，通过两实例正式接口回读及关停后持久文件比对确认恢复。保存后焦点回到网页根，属于另一个已有交互需单独调查，本批改动限文案。
- 两个隔离配置存储均保留相同的三条非秘密文本记录。没有填写密钥型字段。各项目四个已提交文件逐字节一致，留有初始化文件。两库 SQLite 快速完整性检查通过，会话、消息及模型活动均为零。两个自有实例均正常退出并释放端口。
- `test/server/expert-selected-read-identity.test.ts` 通过 3 项、11 个断言。界面类型、双语 3281 项、样式令牌 9353 处、实际构建和渲染边界、文档与架构索引均通过。没有发起模型请求或调整安装选择。
