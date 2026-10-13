# 387 尺寸通知递送调查与修复

## Recall

持续目标按最新人工要求只用单agent，不委托。386是progress：a4cc237a3已推送，真实Sources三文件读取、刷新重开和行号定位已有四张人工复核截图；原8次请求中的memory fetch_failed使严格运行资格失败，原失败保持。另有14条真实ResizeObserver递送错误，尚未归因，不能把错误名或源码候选当根因。当前保留compaction、Explorer、Univer及共享文档的其他修改。385的权限恢复与383完整来源事务继续有效，不改调度/schema/用户实例。

已读386 Recall、完整runtime-review、全部overlay ResizeObserver调用点、AutoGrowTextarea/metrics、ChatComposer toolbar、Card/Conversation/RightDock/SourceParts/CodeEditor调用路径、animation-frame公共primitive、main.tsx当前error分级、07-panel和Vite构建配置。全仓overlay搜索表明AutoGrowTextarea被主/侧聊天、Goal/Mission、Interaction、指引和设置等共用；toolbar只在ChatComposer有一份。多数布局observer已经调度到animation frame；textarea/toolbar仍同步写尺寸，当前只是待检验候选。没有相关UI测试运行；不扫描无关测试。

已查阅[Resize Observer工作草案](https://drafts.csswg.org/resize-observer/#deliver-resize-loop-error)的广播、skipped observations和错误算法。该错误表示有未能在本轮广播递送的观察，并不凭错误文本证明无限循环或某组件闪烁。必须取得具体运行尺寸/回调关系再决定修复。

## 调查方式与输入输出

用当前真实UI构建的私有诊断版本，通过原项目CLI的/ui提供。不新增浏览器fixture、DOM/组件断言、截图基线、UI自动驱动或独立Vite服务器。仅在私有构建的HTML启动处安装临时只读诊断：真实Native ResizeObserver及原callback仍执行，记录callback创建栈、原entry尺寸、回调前后真实box与height样式，以及浏览器错误时的最近调用序列。诊断不设置尺寸、不制造输入、不替换结果、不隐藏错误，不进入产品构建配置或运行持久状态；记录布局时机可能增加测量开销，这一限制保留。

主agent手工在独立页面输入多行、观察真实模型完成、开闭Sources文件侧栏及拖动宽度，并截图人工复核。用同样的真实Native模型旅程产生实际Sources，不注入消息或来源。先证明哪个原callback造成了尺寸变化与跳过递送；若观察指向依赖或其他调用，横审实际同义入口再补方案。仅在根因和影响完成后改产品，并复用现有animation-frame primitive，正确卸载/取消；不加第二高度状态、全局RO补丁或错误抑制到产品。

## 环境、预算与验收

诊断before新scope resize-delivery-387-before（端口18407），必要after独立scope resize-delivery-387-after（18408），均位于C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/。每个scope预声明同进程20次累计Provider请求，目标实际gpt-6.1-sol流式；沿成熟stageDiagnosticProvider成对复制授权auth/models并分别核验凭据、模型投影、真实请求。无活动180000ms，Native物理资源固定最大600000ms独立于无活动判断，先完成构建再启动；不延长旧scope或覆盖失败。

产品UI修复需真实页面输入、变化宽度、读取完成、来源点击和截图复核，不以日志零计数或typecheck替代视觉。后台合同若需要改动，另写明确正向行为检查；本轮计划为纯UI，禁止新增或运行UI自动化。最终私有诊断从正常产品构建排除，只有必要的当前实现提交。每个自有tab/service正常关闭、原exec join、实际Job/output/request和端口退出后移除复制pair。

归档全部脱敏诊断、Provider/Native事实、截图、原失败及人工结论；索引/当前公开合同按实际修改同步，当前文档与构建检查，范围提交、fresh fetch/merge、完整待推送集合复核和正常push。386网络失败、真实崩溃恢复与尚未验证的原subagent侧栏不外推通过；持续goal保持active。

## 真实回调证据与实施决定

before Native Target76316/Host36232正常运行，实际7次Sol流式请求全部200/EOF，三个Read及Sources完成。手工打开方案甲、输入四行未发送草稿、侧栏从380调整到441、回到对话底部；原文件行高亮、草稿和来源保持，截图已人工查看。诊断记录28条，其中13条递送事件的最后回调全部为observer11，创建栈直接指向Virtua.createResizer及其store.$update(ACTION_ITEM_RESIZE)。它测量真实新增/增高的虚拟行，源代码同步更新尺寸缓存、stateVersion与父容器totalSize。原textarea/toolbar回调没有观察到同步目标box变更；初始0条，真实流式内容后13条，后续草稿/拖动/滚动仍13条。此运行排除了先前“通知都来自textarea/toolbar”的假设，不能外推这些组件所有未来路径。

安装的virtua@0.49.3 lib/solid/index.jsx在ACTION_ITEM_RESIZE处明确把同步更新用于减少可见跳动，并指出它会引起ResizeObserver通知；Solid subscriber同步setRerender，totalSize读取新缓存。[上游FAQ](https://github.com/inokawa/virtua/#what-is-resizeobserver-loop-completed-with-undelivered-notifications-error)也说明这种通知。因而当前证据支持“虚拟行同步尺寸结算导致较浅观察在本轮跳过递送”，不支持把它等同无限重绘或用户原始Rendering占位闪烁。没有为清除通知而延期库回调、改全局Observer、取消测量或新增日志抑制；不进行缺乏证据的产品补丁。临时Observer只在私有诊断构建内，产品源码/构建配置保持既有实现；after scope未启动、未复制凭据。

此前诊断构建误在overlay cwd运行根目录prepare命令，复制未发生；外部config又因Vite模块解析位置失败。两处工具链问题已经修正为根目录准备及程序化调用项目唯一现有Vite配置，原失败日志保留。修正后构建成功。before原launcher37065实际exit0/NativeService资格通过；自有tab5关闭，原生Job/output/request与端口完整结束，再成对移除auth/models。没有把386的原fetch_failed改写成成功。

当前对原问题仍未证明的部分是：subagent侧栏逐次消息更新时组件身份、Markdown Rendering占位与真正可见闪烁。本轮确认尺寸通知不能直接作为其根因，后续应调查真实更新与组件生命周期；禁止因本轮警告解释已清楚就宣称原UI问题全部解决。
