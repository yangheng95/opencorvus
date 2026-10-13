# 374 项目文件引用身份与附件编辑边界

## Recall

用户持续要求自主改善 Sources、界面及功能，并已明确改为仅单 agent；不进行开发代理委托。373 的 bbd0efbbdceeb233a6abbff1c68c5c58e111732a 已正常提交推送，374 开始工作区干净。373 after/03-absolute-range.png 实际展示同一项目文件的绝对引用 Read only，after/04 相对引用可编辑；12 图和真实 Sol 流式调用已验。374 复用此改前实页证据，不重新启动无必要的相同改前服务。

已读 373 Recall、07-panel 的 Source/附件/文件保存与身份合同、workspace 正文入口、SourceParts、file-workbench、FileEditorPane、server-path/tool 路径工具、File.read/readSource/writeText、AttachmentStore/ReadTool、现有文件 API、保存和引用服务测试。全仓检索相关函数、FileContent/revision、路径分类与 SDK 生成入口。相关测试是数据/服务/HTTP 合同，不新增运行 UI 自动化。已应用 benchmark-debug-template 与 computer-use 流程；验收使用隔离真实开发服务 /ui、实际截图人工复核。

## 分析与影响

触发：正文 workspace 把任意绝对路径送进 source-content；SourceParts 却把项目内普通绝对路径转换为相对路径。两个入口构成不同 FileEditorTarget，导致只读差异及同文件草稿被当作离开资源。373 修的是范围语法，未触及该分类，编辑器本身正确执行输入身份。

附件 blob 实際位于项目 .opencorvus/.r/project/attachments/<当前数据库命名空间> 下；直接扩大可编辑路由会把附件暴露给普通保存。当前 File.read 会给这种 blob 发放 revision，writeText 也可覆写；仅 Source.origin 的前端只读分支没有约束此实际文本保存入口。AttachmentStore.nameFromAbsolutePath 是现有单一识别契约：当前项目、当前数据库目录及 canonical blob 名称；其 storageDir 只计算路径。元数据 sidecar 与项目别处的同名文件按现行合同仍为普通文件。外部数据库目录不臆断成当前 store。分析过 File 的 create/upload/move/copy/delete：本轮文本编辑能力不宣称取代那些独立文件管理/工具权限，不扩展为全面禁止用户文件系统操作。

实施：File 的项目文本读取只向普通可编辑文件提供既有 revision；canonical blob 仍返回真实文本而没有保存凭据。writeText 在现有物理身份/锁内重读之后，以明确 FileInvalidPathError 拒绝只读文本保存，保留真实错误路径/文案。复用 revision 合同，不增设 readOnly 字段或 SDK 双源。readSource 外部读取仍无 revision，且不额外要求 Instance 上下文。FileEditorPane 用同一 writable 计算统一输入、保存和只读 badge，真实文本显示不受影响。

file-workbench 统一普通引用分类：相对路径及项目内绝对路径走既有项目目标，项目外绝对路径走既有 source 目标。正文和普通 Sources 使用它；明确 origin=attachment 的来源仍调用带原始 displayName 的只读入口。复用 relativePathFrom 的服务端 Windows/UNC/POSIX 规则；绝对路径检测移至 server-path 供现有调用点共用。项目内绝对/相对引用归一为同一 target，现有 admission/draft/reveal owner 保持唯一。物理 symlink/越界仍由原后端校验，不新增客户端权限绕行或物理身份推测。

接口没有新增字段、路由、数据库迁移或非流式调用。涉及共享 Sources/正文/编辑器，不是后台调度修改；若出现真实调度、队列、并发恢复异常则立即按共享机制横向审计。非 UTF8 编辑及359首次复制现象保持独立未知，不以本轮通过替代。

## 验收与交付

先增加实际 File/AttachmentStore 正向合同，证明 canonical blob 返回只读文本、保存返回明确错误，并验证普通文件、同名副本、元数据正常保存及实际完整字节。服务合同验证 Windows/UNC/POSIX、相同引用身份和带草稿的范围导航、项目外及显式附件目标。精确测试、类型与正式 build，不运行 UI 自动化。

仅声明 source-file-identity-374-after /18381 一个 NativeService scope，沿现有 launcher 的固定600000ms、12累计请求，不延长或重开。复制授权 auth 与完整 models 到私有运行根，预检凭据 usable、模型 projected 和实际 gpt-6.1-sol streaming。自己编写项目文件、项目外对照和上传文本附件，通过真实 read 产生来源；真实 /ui 点击相对/绝对/Source，编辑未保存草稿后再次导航并保存，人工查看截图与最终文件字节。附件由真实上传 API 生成，Source 保留实际 origin/title；其复制物理路径及项目相对 blob 打开均只读。项目外对照保持只读。此轮不需要产品 Side 会话即可覆盖共享入口，亦不委托代理。

每项原 launcher、页面、Native、Provider/output/request、端口和 auth/models 成对闭合。真实 checker 验证 API、消息、工具结果和文件字节；不将 checker 替代视觉。完整原证据压缩保留，脱敏扫描；同步当前架构和三个 spec 索引，docs:check、check:architecture-index。范围提交，fresh fetch/merge upstream，审查完整待推集合并正常 push；保留 goal active。

## 实施与验收结果

改前实际 File.read 给 canonical blob 返回 revision，新增只读文本合同失败。另一个改前失败来自 Bun expect.toMatchObject 对后续复用对象中的 revision 注入 asymmetric matcher；诊断确认 typeof 从 string 变成 object，改为标量断言后真实保存通过。完整失败及诊断日志保留，不把测试写法错误报为产品保存故障。

生产改动沿上述唯一分类/版本凭据方案完成，无新协议、字段、加载器或代理。53 项 overlay 数据/服务合同、9 项 backend File/ReadTool 合同、5 项真实 HTTP 文件合同通过；附件测试又覆盖当前 store 的项目内目录链接与 Windows 大小写路径，2 项重跑通过（不重复计入67项）。53839 typecheck 与66308正式build exit0，main-Hg2zJLcN.js。只运行数据/服务/API检查，没有 UI 自动化。

after/18381/page199 使用真实上传 API 创建研究附件374.txt，实际 read 产生3条 canonical Source。首次准备脚本误用 attachment/ 末尾斜杠收到404；对照实际 uploadComposerBytes 的 attachment 路由修正工具，保留事实，未重启scope。首次测试prompt由 Node path.join产生的Windows反斜杠在显式Markdown中的转义有歧义；自然消息追加正斜杠引用，原始消息/Source/输出完整保留。此项不宣称已改动Markdown语法。

01–09九图逐张人工查看：相对引用在2:4键入x，绝对引用及Sources保留未保存草稿；Save成功，关闭后绝对引用重新打开可在2:4键入y并Ctrl+S保存。最终完整文件为原CRLF字节加yx，44 bytes。附件来源保持原名和Attachment标签；附件相对/绝对正文入口只读，实际键入x后内容保持原文；外部来源只读。真实HTTP检查canonical附件PATCH返回400 FileInvalidPathError，原附件34 bytes和外部文件完整字节核对一致。

原14714与shutdown均exit0，Native239504ms，9次gpt-6.1-sol流式HTTP200/EOF，3个真实read完成、主会话两次自然终答及预检自然终答。页面199关闭、IAB为空；Host/Native/output/request/端口/成对auth-models全部闭合。没有新调度/队列/恢复异常。浏览器console记录为空。附件通过正文存储路径打开时标题仍显示存储名，Sources自身保留原始文件名；列为下一轮可读性候选，不扩大本轮结论。
