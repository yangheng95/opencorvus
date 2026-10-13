# 代理认证原值验收

[Recall、根因与方案](../../records/2026-10/2026-10-13-iteration-proxy-credentials.md)。全部身份为公开虚构的本机测试输入，无真实凭据、模型请求或外部代理。

## 功能证据

- [修复前](tests-before.log)：20项，7通过/13失败。证明 schema 裁剪、URL百分号误解码、Bun真实代理及Node真实CONNECT的具体失败。
- [修复后](tests-after.log)：21项/23断言全部通过，含20项身份测试和原fetch-init测试。5种输入分别覆盖schema、浏览器解析、Bun真实本地代理→本地origin、Node Undici真实CONNECT→本地origin。它们是功能测试，不是UI自动化或模型端到端验收。
- [修复前实际保存](before-persistence-actual.json) / [修复后实际保存](after-persistence.json)：真实页面保存到各自隔离项目canonical配置后，以布尔和长度记录身份保真，未记录认证Header。
- [真实页面测试请求](ui-proxy-observations.jsonl)：英文保存后与中文重开后两次CONNECT，原目标和身份均匹配。观察代理明确返回502拒绝外部转发；这证明输入→UI草稿→后端schema→实际代理认证与错误反馈，不是外网连通成功。真正成功传输由上述本地origin测试证明。

## 人工页面复核

| 场景 | 实际截图与结论 |
| --- | --- |
| 修复前输入与保存 | [输入](before-input.png)、[Saved](before-saved.png)：密码遮蔽；实际落盘长度13/17且原值比较失败 |
| 修复后英文保存 | [Saved](after-en-saved.png)：实际落盘长度15/19且原值比较成功 |
| 英文测试的真实本机拒绝 | [502反馈](after-en-proxy-result.png)：完整可见的错误摘要，身份观察匹配 |
| 切中文、重新打开Network后再测试 | [中文反馈](after-zh-reopened-proxy.png)：身份再次匹配，产品文案本地化、密码遮蔽、控件可用 |

截图均经真实 /ui 页面操作后人工查看。桌面浏览器范围，无UI源码文案/DOM断言、快照断言或自动化测试。页面成功反馈不独立证明数据正确，已结合实际配置与网络传输证据。

## 服务、检查与边界

修复前源码listener/recovery服务66004完成server.stop，[实际终态](before-terminal.json)与原exec exit0已取得。修复后72688与本地观察代理79740在跨turn后原tool handle已丢失；重新检查端口已关闭，72688被不同出生时间的conhost复用，[物理观察](after-physical-observation.json)保留。该after服务没有terminal文件，因此不声称其正常exit0或生产结算成功。功能与页面证据为退出前真实行为，最终追加新scope做可观察的主动收尾，不重启旧scope。

原scratch名与另一个并行任务意外相同，仅ui-after构建目录有潜在交叠；本次服务持有启动时不可变资源快照，以上原值/实际请求证据完整。最终构建与服务迁至唯一`.tmp-codex-proxy-credentials-01a133`，不修改另一任务文件或进程。

已通过Overlay类型检查、私有正式构建、两语言2156键目录检查、docs:check（345 operations/25 groups）；这些不替代页面验收。最终构建/收尾与Git提交推送结果在月记录补齐。无新版本、tag、Release或真实Provider验收；Node/Bun与浏览器代理数据合同通过，不声称实际原生Tauri代理或外网可达。

最终唯一目录构建65秒exit0，新服务[ready](final-ready.json)打开真实中文页面，[已保存截图](final-zh-saved.png)人工查看且[canonical配置原值](final-persistence.json)两项均true。关闭自有页面后请求生产server.stop，原exec30033返回exit0；[终态](final-terminal.json)与[物理退出/端口关闭](final-physical.json)完整取得。原after未知退出事实保留，不用最终成功覆盖它。
