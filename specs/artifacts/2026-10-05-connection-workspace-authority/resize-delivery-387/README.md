# 387 尺寸通知与真实页面诊断

[方案与Recall](../resize-delivery-plan-387.md) · [月度记录](../../../records/2026-10/2026-10-13-resize-delivery-387.md) · [被动尺寸记录](resize-observations.json) · [真实运行复核](runtime-review.json)

## 观察结果

本轮私有诊断构建保留真实Native ResizeObserver和原callback，只记录创建栈、entry尺寸、回调前后目标box及错误附近调用序列；没有UI自动驱动、断言、fixture、快照基线或产品全局补丁。日志分析是描述性记录，不是UI通过分数。

手工操作当前localhost:18407/ui：通过真实Work/Chat请求三个文件第2—3行，流式阶段打开方案甲来源；回复完成后输入四行未发送草稿，将右侧栏从380拖到441，再回到对话底部。主agent实际查看[流式Sources](before-stream.png)和[草稿、来源与文件高亮](before-draft-and-sources.png)，来源和已输入文字保持，原文件第2—3行可见高亮。

共28条被动诊断，13条浏览器递送错误的最后回调全部为observer11；创建栈与原callback直接指向Virtua.createResizer的ACTION_ITEM_RESIZE更新。初始0条，流式内容测量后13条，之后多行草稿、拖动和滚动仍13条。输入框/工具栏回调未观察到同步目标box变化，因此该轮证据不支持此前候选归因。测量会增加开销，目标box相同也不排除所有后代变化，结论不外推未走到的路径。

安装的virtua@0.49.3同步更新尺寸缓存，再经Solid subscriber更新虚拟容器totalSize；源码说明同步结算用于减少可见跳动，并会引发ResizeObserver递送通知。[官方FAQ](https://github.com/inokawa/virtua/#what-is-resizeobserver-loop-completed-with-undelivered-notifications-error)和[规范的错误算法](https://drafts.csswg.org/resize-observer/#deliver-resize-loop-error)与本轮事实一致。当前判断为虚拟行尺寸结算中较浅观察被跳过递送；这不证明无限重绘，也不是原Rendering占位闪烁的复现。

## 实施决定与边界

没有为了清除该通知而延期库回调、改写全局Observer、放弃测量或追加日志过滤。产品代码未修改，诊断只在私有构建中；after scope未启动。后续应从真实消息更新和组件身份调查原Rendering闪烁，不能把这轮调查包装成原问题全部修复。

7次实际gpt-6.1-sol请求均stream=true/HTTP200/EOF，3个真实read/Source与原Tool/Message/文件内容匹配。原launcher37065 exit0/NativeService资格通过；Target76316/Host36232在395715ms后正常退出0，Job/output/request完整收敛、port18407释放，复制auth/models在物理结束后成对移除，自有tab5关闭。386的原memory fetch_failed仍保留，不覆盖或续额。

首次诊断工具链的cwd和外部配置模块解析失败已保留；修正为根目录准备、程序化调用现有项目唯一Vite配置后构建通过。checks保留全量脱敏诊断、Provider/Native日志、实际静态入口与主模块、原脚本和失败输出；压缩完整性与凭据扫描不替代实际行为验收。没有用户实例操作、schema/迁移、分支/worktree、委托或发布。
