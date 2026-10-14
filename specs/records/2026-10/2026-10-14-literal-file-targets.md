# 原始文件目标与原生编辑器启动

## Recall

持续目标继续，最新人工要求只使用一个开发agent，旧goal中的三个Astra不再适用；不创建或调用子agent。上一轮d846ce827的真实Sources密度修复已正常推送并与origin/main一致，属于progress；复制按钮反馈已验但工具虚拟剪贴板粘贴链未验，不能改写为通过。本轮先追查该边界，再自主发现并修复真实路径传递缺陷。开始HEAD d846ce827，工作区只有原有.bun和packages/opencorvus/bun，均保留。

## 修改前分析与全仓搜索

共享copyText仅调用HostTransport.native clipboard.writeText；浏览器生产适配器直接await navigator.clipboard.writeText，桌面走Tauri插件，成功反馈在await后更新；浏览器明确不声明clipboard.readText。未发现产品合成成功分支，工具虚拟剪贴板与页面writer的隔离仍是当前证据边界，不为此新增复制实现/权限或假粘贴。

已读取SourceParts、file-workbench、server-path、tool.relativePathFrom、file-reference/Markdown、workspace全部文件操作入口、nativeOpen、HostCommand定义/适配器、Rust overlay_open_path/overlay_open_project_editor与ProjectEditor全部实现，以及07-panel路径保真/位置合同、364预览决策、421 Recall、已有reveal-path-host-action/workspace-file-identity/clipboard-single-writer/file-reference测试。Sources和内置文件workbench当前已保留文件字符；global项目目录选择和自然语言引用解析是现有合同明确独立范围，不扩大清理。上述现有测试为纯主机命令/路径数据映射或构建解析合同，未发现DOM/组件渲染或源码文案断言，不把它们当UI端到端。

确定的直接缺陷：workspace.revealPath和openProjectPathInEditor对来自真实资源的target.trim，Rust overlay_open_project_editor再次path.trim，导致首尾空白/Unicode空白不再是原文件身份。旧workbench修复没有覆盖原生IDE和路径交付入口；已有reveal测试甚至固定了错误的trim合同，必须按当前文件身份合同替换。全调用包括日志路径、Skill位置、工作目录显示，以及Explorer/正文引用/编辑器入口。empty检查可校验空值，但不应把经裁剪的字符串当实际路径。Native open-path当前仅用trim检查空值，传递原字符串，保持这一事实。

另发现Windows带行号的编辑器启动手工Command(cmd).args(/C,program,args)，其CRT quoting不等于cmd规则，合法文件字符可能被解释；旧注释声称必须这样启动cmd脚本，与当前Rust标准库批处理处理相冲突。原生行号CLI启动失败还有降级为普通打开的旧路径，会丢失用户要求的行列，修复应让真实启动错误进入现有本地化错误反馈，不继续错误动作。对Windows特殊字符是否实际丢失，需受控真实argv证据，不凭注释宣称已复现。

已查权威资料：[Rust进程/Windows批处理](https://doc.rust-lang.org/std/process/#batch-file-special-handling)、[Rust官方CVE-2024-24576说明](https://blog.rust-lang.org/2024/04/09/cve-2024-24576/)。本机rustc/cargo1.98.1；当前在线标准库1.99文档说明Command对直接cmd/bat目标应用专门转义，不能安全编码时返回InvalidInput。采用成熟标准库直启launcher，不能自行拼接raw shell命令或用字符过滤遮蔽合法文件名。

## 方案、影响面与验收

1. 先在真实checker中证明literal目标合同：已有Host命令测试改为精确保留首尾空白/NBSP，增加原生IDE位置命令的正向参数输出；纯主机API数据契约，不新增或运行UI自动化测试。保存修前失败，改前有差异的文件先保存原件并复核。
2. 同时修复TypeScript和Rust实际目标传递。Windows launcher改用标准库对真实program的处理，保留同一现有ProjectEditor事实来源与参数构造。删除行号启动失败后丢弃位置的旧打开分支；空目标与真实启动错误保留明确合同。不得引入平行配置/新fallback/临时白名单。
3. 对全部五个编辑器的实际argv和Unicode/空白/Windows元字符做聚焦正向验证；优先使用受控临时code.cmd与真实子进程记录argv，而非static字符串断言或启动用户IDE。若Rust构建/运行器故障先修工具再重跑；不伪称mock主机测试已打开真实IDE。原生应用命令是用户界面主机的启动交接，不进入Task/Mission/Session调度、队列/唤醒或持久终态，本轮不改这些机制；若出现共享控制层异常再立即横审。
4. 正式Node构建后，开发服务/ui使用隔离真实文件与既有单主会话、真实Sources/Explorer点击及截图人工查看，验证普通打开/行号引用仍指向同一文件。Native IDE最终窗口显示受当前可用浏览器工具边界约束，未知项如实列出。真实Provider若需要仍auth+models配对、精确Sol/流式预检，单scope12调用、180秒无活动、NativeService600秒；构建先于服务。截图后立即公开shutdown/原句柄join/physical+output+request及凭据配对退休。
5. 保存声明的输入/命令输出、失败和修后事实；更新唯一07-panel与三索引，执行当前文档/类型/必要Rust检查。只提交本轮范围，freshfetch/merge/fullpendingaudit/正常push后自主下一批；不创建版本、Release或tag，不改数据schema或清库。

## 实际根因证明与实现

修前真实checker：reveal-path-host-action的3个新literal输出失败，workspace-file-identity新增原生目标的2个失败；实际输出均丢失首尾空白或NBSP。修改workspace的两处真实target赋值为原字符串，空输入校验与实际路径分开；修后两个checker共13项/23断言通过。它们是纯主机命令与路径状态合同，未创建DOM、渲染组件或检查源码文案，不当作页面/原生IDE验收。

Rust先把现有启动命令原样移入同一ProjectEditor.line_command，使真实生产命令可交给受控程序接收；没有先改Windows命令语法。Cargo首轮完整编译后，真实code.cmd启动检查失败；追加原argv记录后的第二轮仍失败，日志明确VS Code status=1、argv=["--goto", "C:/repo/A"]，以及B被解释成另一命令。输入是C:/repo/A&B/reference.md:3:15。受控程序只写argv原件，未打开用户IDE、执行危险命令或伪造启动成功；原失败与原源码快照保留。

现有Windows手工cmd /C包装采用了错误的解释器语法；改为Command::new(实际launcher)，让当前Rust标准库执行其批处理专用转义。路径/位置参数仍由唯一line_arguments产生。原生overlay_open_project_editor停止裁剪路径；有位置的启动错误直接回到已有本地化反馈，移除丢弃位置的旧打开分支及只为该分支服务的spawn函数。错误附带实际程序标识，品牌/程序名及OS原错误保真。无位置的原生文件关联仍执行自己的明确请求。

同时将现有Linux CLI名称表供Unix命令启动共用，Mac原生opener的应用标识继续只用于文件关联，行号启动改用CLI名称；没有把应用显示名当可执行文件，也没有新增用户配置/发现旁路。CLI必须实际可用；不存在时报告真实错误。本机未做Mac/Linux或真实厂商IDE窗口验收，源码统一不等于这些平台均已通过。

Windows生产命令工厂实际启动了受控code.cmd/cursor.cmd与三个真实exe别名，五类编辑器×六个路径共30次：含&、尾NBSP、空格和括号、字面%变量%、!及^。原始接收argv、退出状态0和完整stdout/stderr join逐一保留，和明确位置参数合同一同通过。测试仅在自身进程临时添加所拥有的程序目录，恢复原PATH；没有改用户进程环境或启动用户IDE。缺少launcher另在独立自身测试进程和空程序目录中验证ErrorKind::NotFound。4项Rust合同通过，64项其他测试未运行；这里证明的是原生命令和操作系统参数交接，不是厂商IDE内文件加载完成。

## 实际Web页面与范围边界

正式Node构建71010 joina003f2 exit0（1分钟，有第三方use-client及chunk警告）。第一次准备脚本因从overlay cwd引用root相对路径失败，随后从root正确执行，未把首次准备称成功；Vite构建本身使用正确package cwd。隔离材料实际创建identity-422.md加尾NBSP，以及没有尾NBSP的另一个文件，内容有不同标记；不更改消息或Source数据来制造场景。

自有18565/ui页面3复用已有主Session，真实gpt-6.1-sol只做一次search_code检索原始标记并自然完成。01实际显示真实Source；02点击带尾NBSP的来源后文件工作区显示IDENTITY_LITERAL_NBSP_422并定位第1行第3列，对照文件的IDENTITY_NORMAL_422未混同。两张原图已人工查看。该普通Source/workbench路径本来已保真，本次是其共享路径改动后的真实回归；不将它冒充此次原生IDE行为的修前复现或真实IDE窗口验收。完整复制粘贴链仍保留421工具边界，没有改产品剪贴板或伪造粘贴。

scope具备完整auth/models配对及Sol credential/catalog/actualModel/streaming预检；Provider次数和终态以归档最新审计为准。公开shutdown dbdac7 exit0、原53001 join4ec4c3 exit0，physical/output/request与精确实例退场、复制配对退休完成，页面3关闭。数据库仍为版本2，原消息与测试文件保留；没有新增产品子成员或开发委派。

最终将literal交付矩阵同时覆盖browser/tauri两种主机，两个TypeScript checker共16项/29断言通过；Rust最终原19868 join281f7a exit0，4项合同/30个受控launcher进程通过。最新Provider审计5条均gpt-6.1-sol、streaming=true、HTTP200、reader settled/eof。最新真实search_code为prt_g0VY1hzgG00fGVbWHu7Z，Source prt_g0VY1hzu8002wOW7Y4hf属于msg_g0VY1hxkY00J7eX5Kc86，保留末尾NBSP及1:3范围。只读数据库和真实两个文件内容单独归档，不用可变源码摘要代替身份/功能验收。docs与architecture索引检查通过，正常Git hook仍将完整复验。
