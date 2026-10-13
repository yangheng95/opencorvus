# 376 服务实例的完整前端资源快照

## Recall

用户持续要求自主深入体验、修复Sources/渲染/UI（User Interface，用户界面）和功能，最新明确只用单agent。上一轮375为实质进展：6f8aed08728e103e6b2dcc03d42cf52325759f5c已普通提交推送；14合同、12人工截图、真实6 Sol EOF，原15128/Native568620ms与全边界闭合。376开始git status为空。旧goal中的Astra委托已被最新人类指令覆盖，不委托。

本轮线索有直接证据：375 page200在目录重建后复用main-DBS38_Bl.js，02:14:43.552请求markdown-render.worker-D_K6Yc7v.js得到404，00b显示Markdown rendering failed；自身页面刷新后main-CAo85tzZ.js和worker-CF9y63Km.js均200。不是仅凭错误标题推断。全仓搜索freezeOverlayUiDirectory、freezeDefaultOverlayUiSource、FrozenOverlayUiSource、OverlayUI.routes/validatePath、相关指纹字段、Server.App/listen、构建脚本及旧决定e48c3cbdb。已读375 Recall、overlay-ui完整入口/枚举/路由、Server绑定、Vite配置、expert-squad-evolution-e2e显式source调用点、现有frozen-source测试、server-runtime-readiness及07-panel相关契约。

## 根因与影响面

freeze只保存目录路径、部分index内容和摘要；请求仍执行Bun.file/realpath读取可变目录，HTML正常请求甚至重新读index。Vite emptyOutDir替换文件后，旧index引用的延迟worker/chunk被删除；HTTP头仍声明启动时identity。默认freeze不传manifest/static目录，只记录首页直接引用，资源闭包也遗漏延迟文件。旧测试仅在另一个目录构建第二套资源，原目录未变化，无法检出。测试中的HTML子串及摘要形状断言不证明归属，应删除。

生产入口为Server.App、普通Server.listen（CLI、NativeService、SDK服务），都由每进程bindOverlayUiSource固定一次；外置执行文件相邻ui目录、工作区dist-vite和编译embedded是既有来源。显式演化验收source通过同一构造器与ListenOptions传入。routeInventoryApp仅missing source。文件输出和运行进程是本问题对象；已由真实GET404、构建替换和代码排除LLM Task/Mission/Session调度、队列、唤醒或终态异常，不把后者做无依据的状态机修改。仍需覆盖两个独立source、重复请求、目录内容替换/删除、新进程新捕获、路径安全及embedded路径。没有数据库或模型协议变化。

## 实施方案

在既有freeze构造时读取完整发布目录，包含首页、全部延迟模块/worker、语言、字体、图片和license。沿现有物理边界/普通文件校验拒绝越界或非普通条目；manifest依赖和requiredStaticDirectories仍是输入完整性校验，不成为另一个服务目录来源。所有身份字段从同一次捕获的字节派生。捕获过程文件丢失或依赖缺失明确失败，不增加重试或旧版本后备路径。

使用标准不可变Blob保存资源，私有Map通过只读readResource函数暴露查找，外部不能修改资源集合或字节。HTTP（Hypertext Transfer Protocol，超文本传输协议）响应只读取这个实例的快照；目录和embedded采用同一资源服务逻辑。删除按请求读取共享目录的旧实现、已无调用方的validatePath及重复embedded读取分支，保留捕获时安全检查和请求路径准入。来源选择顺序和每进程绑定/冲突合同保持当前含义。服务进程退出即释放内存，没有后台清理进程、平行配置、文件监视或自动刷新用户页面。当前完整产物440文件、30495230字节；快照内存代价必须记录，不以惰性磁盘读重新引入缺口。

首页及所有HTML也来自同一快照。核对既有public-prefix/嵌套路径重写对Vite base=./的处理，若与现有文档路由合同不一致则在同一HTML重写处修复，不新增路由旁路。摘要仅标识确切不可变资源，不以格式正则、可变源码重算或摘要相等代替行为验收。

技术依据：[Node Blob文档](https://nodejs.org/download/release/v22.17.0/docs/api/buffer.html)确认构造时复制输入字节；[Hono Context](https://hono.dev/docs/api/context)和[官方类型源码](https://github.com/honojs/hono/blob/main/src/context.ts)支持标准响应/Blob。实现仍须通过仓库实际Bun/HTTP运行确认，不用文档替代执行。

本地验证纠正：当前安装Hono的c.body类型尚不接收Blob，虽然实际HTTP字节测试通过，49010类型检查明确失败；采用每次请求调用Blob.stream()的标准ReadableStream输入，保持独立流及不可变字节。补充串并行完整响应合同。此项以仓库安装版本为准，未强转绕过类型或升级依赖。

## 验证与运行边界

删除旧HTML源码/摘要形状断言及仅服务这些断言的UI表达，重写为后台静态资源所有权合同：不透明二进制payload的完整HTTP响应字节、状态/类型/来源头，原目录替换或移除后原source仍返回原字节，新capture返回新字节，延迟资源覆盖、错误路径与安全准入。它不启动浏览器、不解析DOM、不检查HTML/JS文案，不称作UI验收。实际UI只用真实开发服务的/ui、人工操作和截图；不新增/运行UI自动化测试。

声明唯一ui-resource-snapshot-376-after /18383 NativeService，沿原launcher固定600000ms/12累计Provider请求，不延长或重启同一scope。为避免干扰用户服务的共享dist，复制已用Bun二进制到独立私有bundle/bin，并把当前真实正式前端复制到相邻bin/ui，使用生产已支持的执行文件相邻ui来源。私有launcher只改变本轮Host/Target可执行文件路径，仍执行原CLI、Provider审计、原生前台ProcessFacade/ProcessSupervisor、ready/settled和清理协议，不插入test-only服务配置。bundle目录与fresh RunRoot分开，原fresh检查保留。先确认私有可执行文件与来源完整字节一致。

真实Sol读取自身项目文件产生Source与自然回复，查看初始页面。随后通过现有Vite build命令向该私有ui目录执行真实不同minify设置的构建，替换worker/chunk，绝不动用户页面或共享dist。自身页面重新进入同一会话，实际Markdown/Source显示正常；首次打开文件编辑器触发延迟模块，验证同一资源仍可用。独立HTTP检查器核对重建前后原资源完整字节与固定来源身份，并由真实新capture验证新产物。原目录被删除的合同在后台临时目录验证，不删除私有Bun。记录所有真实资源输入、请求、模型流、native结果与截图。

复制的实际运行器为现有Bun1.3.14、98480216字节，与原二进制完整字节相同；本轮构建/测试使用声明的Bun1.4.0。私有UI另添加一个32字节的独有二进制资源，原件保存在bundle目录外层；实际GET其完整字节可证明服务选择了私有相邻ui目录，而非内容相同的共享dist。它仅用于HTTP资源归属，不是UI夹具或伪来源。原正式UI440文件、30495230字节完整复制不变。

结束前关闭自身页面，join原launcher，闭合Host/Native/output/request/端口/auth-models。授权凭据和完整models必须成对私有复制，preflight usable/projected/actual gpt-6.1-sol streaming分别确认。敏感内容不进入prompt/日志/spec/commit。更新当前架构与根/月/产物索引、文档检查；范围提交、fresh fetch/merge、完整待推集合审查及普通push。截图和HTTP合同分别报告；涉及未验证的编译embedded运行或其它平台应明确列出，goal保持active。

## 实施与真实验证

删除117行旧UI源码/摘要形状夹具断言，新增后台不透明payload真实HTTP所有权合同。改前1pass/7fail；最终11pass/32断言，涵盖完整资源、目录移除、重用目录、新资源404、串并行读取、Unicode/空格/百分号、无效/越界路径及manifest/required-directory合同。49010首次类型失败后使用每请求Blob.stream，37815类型检查exit0。HTTP返回内容与公开资源身份相符，未新增UI自动化。

原私有Bun完整复制98480216字节；正式UI440文件30495230字节另加32字节纯HTTP归属资源。实际18383/ui接口取回该独有资源，证明绑定私有目录。51676以现有build:vite --outDir私有目录 --emptyOutDir --minify false真实重建，exit0/50.59s；新main-tGz5a9EI.js、worker-DqbgtJ0U.js和CodeEditor-DOnjp3fh.js替换原产物。原服务在重建后仍返回原main-CAo85tzZ.js、worker-CF9y63Km.js、CodeEditor-KqnXIBNR.js的完整原字节并保持原identity。独立新capture真实HTTP返回新产物，440资源、约345ms捕获（过程内存记录不当作精确Blob占用指标）。

page201的01–05共5图已逐张人工查看：01真实read/Source与自然终答；02重建后reload和重新选择同一会话正常显示；03首次加载旧版CodeEditor成功并Ctrl+S保存x，实际项目文件65字节、CRLF保持；05返回/ui根入口再次正常显示。项目文件动态保存没有被冻结。

04是额外探查的未解决项：/ui/inspect/resource/的脚本/CSS地址已正确回到/ui/assets，但客户端继续GET /ui/inspect/resource/i18n/zh-CN.json和en-US.json，收到文档200并解析失败，随后MissingI18nKeyError阻断错误展示。保存了截图、console和实际HTTP证据；不宣称嵌套文档初始化已通过，也不把它归为原资源快照失效。下一轮审查客户端资源基址与bootstrap失败呈现的共享入口。

原84566及shutdown实际exit0，Native578003ms（原600000内），5次Sol流式HTTP200/EOF、1个真实read及自然终答（另有预检终答）。全部Host/Native/output/request/端口、临时auth/models和页面201闭合，IAB为空。源共享dist与用户窗口/进程均未操作；只重建私有副本。编译embedded实际二进制运行尚未执行，此轮为真实CLI目录来源验收，embedded走同一捕获与服务实现并经代码/类型复核。范围提交、fresh upstream合并及普通push后继续goal。
