# 编辑器加载使用会话模型作用域

## Recall

- 用户要求本人持续分批调查，先完成根因与影响分析并落盘，再实施、真实 Windows 桌面交互和截图复核、聚焦正向测试、范围提交、合并上游及普通推送。第 315 批 `dd0e5e475` 已推送，上游同步，原有 177 项工作区状态逐行一致。
- 已读 `AGENTS.md`、[扩展架构](../../current/architecture/04-extensions.md)、[配置架构](../../current/architecture/05-config.md)、`EffectiveConfig`、唯一模型解析器、会话创建/加载/派生/恢复、根会话覆盖、模型选择及公共配置路由。全仓查 `defaultModel`、`resolveConfiguredModelRef`、`setSessionConfigOption`、`Session.fork`、`configOverlay`、父级配置继承、命令执行及聚焦 ACP（Agent Client Protocol，智能体客户端协议）检查。检索路径未见界面自动化测试。[ACP 当前配置选项](https://agentclientprotocol.com/protocol/v1/session-config-options#initial-state) · [会话加载](https://agentclientprotocol.com/protocol/v1/session-setup#loading-sessions)
- 本批使用隔离本机流式 `acp-review/local` 和 `acp-review/scoped`，分别明确投影为项目默认模型和会话保存模型。核对真实请求模型、公开持久输入及助手、原生编辑器当前选择、加载/恢复/派生与另一独立会话。无外部凭据。

## 修改前现象、根因和影响

实际 `opencorvus acp` 端口 `40090` 新建 `ses_-zUOeEQR8zzn8xOjvutH`，配置覆盖写入请求 `b482709c-5d15-4a12-a099-c26d41223647` 返回 `config.model=acp-review/scoped`、`origin.model=session`，结束后公开读取仍相同。官方客户端对该会话 `loadSession`、`resumeSession` 及派生 `ses_-zUOeEPU2zzGkMxpaNkZ` 的配置选项却全部返回 `acp-review/local`。三次真实后续流式输入的持久助手均记录 `modelID=local`，实际模型服务收到的请求也为 `model=local`、`stream=true`，均按对应输入父级完成为 `stop`。真实 Windows Zed 1.28.1 从历史打开同一会话，模型选择器显示 `acp-review/Project base`。[实际配置、协议、模型请求和实拍](../../artifacts/2026-11-19-acp-session-model-scope/README.md)

`ACP.defaultModel` 已调用唯一 `resolveConfiguredModelRef`，但进入 `Instance.provide` 后没有把已知会话身份交给解析器。这个入口没有环境会话上下文，`EffectiveConfig.effective` 因而只读取项目基线。加载、恢复和派生共用此调用，随后把错误模型存入连接内状态并作为明确模型随提示发送。公共输入解析器正确遵守明确选择优先级，因此实际请求绕过了已保存会话覆盖。仅统一解析器而省略作用域的旧实现无法完成配置继承。

会话配置只有根会话拥有。普通派生保留父链，已有 `EffectiveConfig` 沿父链定位唯一根覆盖，无需复制配置。新会话尚无既存身份，继续使用当前项目配置。ACP 用户即时模型选择属于连接内的明确请求，保持其已有合同。原模型历史、当前配置、消息、模型目录、角色及权限、公开接口和数据库格式均无需迁移。风险集中在加载拿错会话、派生漏继承、独立会话串用覆盖、失败初始化留下状态以及误把历史选项充当持久配置。对公共提示、命令、Task（任务）和 Mission（使命）相关的共用解析及配置作用域进行横查，根覆盖和明确模型的流转一致；本批证据为 ACP 入口丢弃配置作用域，未观察到调度、队列、执行轮次恢复、并发和终态收敛异常。旧记录的实际模型事实保留，重载后新输入应使用当前配置。

## 实施与验收

- 已知会话的模型读取向当前唯一解析器传入其 `sessionID`。加载和恢复绑定目标会话，派生在当前父链合同下绑定源会话；已存连接缺模型时的读取同样使用该连接的会话。新建继续使用项目作用域。删除任何历史推断的可能性，配置来源仍由 `EffectiveConfig` 决定。
- 正向检查已保存根覆盖在加载、恢复、派生及派生重载后的明确模型值、实际流式输入和持久助手。独立新会话使用项目模型，连接内显式选择使用所选模型。真实 Zed 加载同一已存配置并从桌面发送后续输入，核对选择器和实际模型。通过同一开发服务 `/ui/` 检查隔离项目，逐张复核截图。执行聚焦 ACP、配置覆盖及模型解析检查，类型、文档与架构索引，范围提交及正常推送。
