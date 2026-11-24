# 项目配置跨标签刷新时保留设置草稿

## Recall

用户要求本人独立按批次持续迭代，先核对真实行为、根因和影响并落盘，再实施有证据的修复、通过桌面交互与聚焦测试验收，最后范围提交、合并上游、正常推送。本批只核对项目配置跨页更新后两个设置表单的行为。起点 `84b8668ab` 已与上游一致。仅使用专用开发服务和隔离项目。

已读[项目配置跨标签同步](2026-11-24-project-config-peer-notification.md)、[断线补读](2026-11-24-project-config-after-stream-rejoin.md)、[全局同步](2026-11-24-global-config-peer-notification.md)、[代理草稿](2026-11-09-network-proxy-preserve-newer-draft.md)、[通道地址草稿](2026-11-10-channel-public-url-draft.md)和[当前配置架构](../../current/architecture/05-config.md)。在仓库查找 `project.config.changed`、`refreshWorkspaceConfiguration`、`loadConfigInfo`、`server.publicUrl`、`publicUrlDraft`、`draftGeneration`、`adoptedDraftGeneration` 及 `patchConfig`。前两份草稿规格覆盖了本人保存期间继续输入，这次验证由另一页的真实保存引发的刷新。

## 影响分析

项目实际保存广播 `project.config.changed`。同目录页面通过共享的工作记录流收到提示，由 `refreshWorkspaceConfiguration` 调用 `loadConfigInfo` 读取有效配置。若表单直接用每次读回的值覆盖编辑框，另一页的保存可能同时丢弃两个表单里尚未提交的输入。旧的同页保存验收无法证明跨页通知已到达，也无法证明无草稿页面能同步新值。

`ChannelsPanel` 显示当前作用域的 `publicUrlDraft()` 或已确认的 `publicUrl()`。`NetworkPanel` 用编辑世代区分已采用配置和未保存编辑，当前作用域的重读会在草稿仍归作者时保留它。本轮实际结果符合这两个消费路径。影响范围是同项目在线页面的配置读回与两个设置表单。并发提交冲突、外部渠道投递、代理连通性及执行任务属于其他路径，未在本轮触发。没有产品行为变化，因此无需改变接口、存储、迁移或发布内容。

## 桌面验收

- 开发服务 `127.0.0.1:41900/ui/` 使用 `main-Cq7Ng1ni.js`。四个独立浏览器标签通过实际项目入口打开 `branch-review` 的设置，均成功连接工作记录流。干净观察者通道地址初始为空。另两个观察者分别在通道地址与网络代理地址输入不同草稿，并保持编辑框焦点。
- 操作者通过实际通道表单保存 `http://127.0.0.1:41900/accepted-576`，请求 `dc364c8a-ef42-4298-98fb-a7431b4f8fb5` 于 `12:52:22.009Z` 返回 200。其后四次工作台配置读在 `12:52:22.013Z` 至 `12:52:22.018Z` 返回 200。干净观察者未重开页面即显示已保存地址；另两页仍显示各自先前的草稿及焦点。已人工查看[四张桌面截图](../../artifacts/2026-11-24-settings-drafts-on-project-refresh/README.md)。
- 直接读取公开项目配置及隔离项目磁盘配置，确认当前通道地址为已保存值，项目授权值仍为原有的 `full_access`，代理开关仍处初始关闭状态。隔离数据库的会话、消息、执行任务、模型请求各为 0。仅操作者执行配置写入，代理未保存或测试。专用服务正常退出。
- 验收未复现草稿丢失。本批只提交实页证据及调查记录，没有产品代码改动或新增自动化测试。
