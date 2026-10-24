# 来源文件定位与新焦点归属

## Recall

568继续单agent自主迭代，后来的禁止子agent要求覆盖旧Goal Astra文字。567为progress：48892bcd5已正常推送、fresh0/0，十四图补齐四条真实来源复制、分组与成员Dock重开读位；原95433/launcher/native/physical/output/request完整闭合，2次真实Sol预检原reader EOF，auth/models成对退休，90表179313源原行/字节mtime/schema5/canonical保持。成功和延迟粘贴失败分别归档，具体CUA剪贴板内部或其他writer未知，不推断产品错误。用户整体Goal active，本批不重做复制或将既有通过当文件打开资格。

用户要求Sources/Rendering优先并自主继续修UI/功能，内置浏览器与隔离OpenAI完整凭据/模型目录使用已授权。用户曾明确要求Goal放命令或加号，当前入口保持；不因旧早期首页记录把Goal常驻UI加回。开始HEAD48892bcd5，仅171项原无关tracked删除与.bun/、packages/opencorvus/bun/未跟踪，无暂存，保留所有其他改动，不branch/worktree，不发布、不碰用户18571页面/进程/库。

已读567 Recall/原来源与闭合、07-panel/07-panel-reactivity文件/Source/焦点合同，SourceParts→openFileReference→规范FileEditorTarget/reveal revision→FileEditorPane实际GET/内容owner→CodeEditor定位与focus全部相关代码；全仓搜索CodeEditor四个使用点，只有FileEditorPane提供lineRange及reveal revision，Artifact消费者不提供引用范围。复核source-entry-navigation514、source-main-file-reading526及dock-tool-launch-focus527：旧“空白工具页打开后BODY”已在527和当前RightDock onClick交共享reflow/focus实现修复，不以旧记录判断现版本仍失败。

## 修改前分析与影响面

路径/协议候选已排除：相对/绝对路径规范化保留文件名字元；GET file/content与source-content查询不trim；search_code用UTF-8原字节转UTF-16位置，并有前置不匹配bare-CR扫描，不能从片段误判列单位或行数错误。原物理来源文件与同名NBSP身份需要实际导航验证，不改源数据或制造Part。

当前待复现的新候选：FileEditorPane在loading时不挂载CodeEditor，慢GET期间用户可继续在Main输入。读取完成后CodeEditor按原reveal identity等待可见布局/CodeMirror measure，然后无条件editor.focus()；现有identity/visible校验只保证当前引用和布局，不证明旧显式打开请求仍拥有键盘焦点。新输入框焦点可能被晚到的定位抢走。旧527修的是空工具按钮隐藏后的交接，526修的是关闭，不覆盖异步内容挂载后的范围定位。

影响为所有经FileEditorPane打开的带range项目/绝对Source文件，以及同资源的新引用和布局等待；非range Artifact编辑器/图片/PDF、后端文件读写、权限、schema、消息/Provider与执行调度预期不改。定位应保持原行列、高亮和滚动，键盘交接必须尊重请求发起后新取得的焦点。不能通过禁用定位、抢回新输入或定时重试掩盖问题，也不能把新焦点所有者当“偶发”。当前无调度/队列/唤醒/恢复/终态异常；若真实出现立即按全部Task/Mission/Session occurrence、正常/终态、重启/重试、串并行及多项目横审。

方案候选仅在实页证明后实施：在始终存在的FileEditorPane、原显式reveal revision产生时捕获真实focus origin，使其跨读取/延迟挂载传给现有CodeEditor定位；定位完成只在该origin/BODY或同一编辑器仍拥有焦点时调用focus，新焦点优先。复用原revision/组件lifetime和现成布局调度，不新建全局focus store、导航通道、API或持久配置。实施前还需核对实页与权威CodeMirror focus/measure合同，未知处不先改。

## 实施前方案与验收

1. source-file-focus-568-before独立54054，从闭合567完整复制90表实际原数据、schema5对象/完整性与完整canonical，源字节mtime保持。使用565最终完整main-D5Ah_P6W.js/source CLI `/ui`，非独立Vite。配对完整OpenAI凭据与models并分别验证凭据/目标投影/真实gpt-6.1-sol流式预检，每scope4次、全批8，预期各2预检；不发业务消息、Goal或创建成员。
2. 20分钟原生边界，启动无活动180秒，至少五分钟主动收尾。原Server.TestHooks.beforeRequest只对实际GET /file/content、/file/source-content等待8000ms，原路由/文件/响应保留，15秒原HTTP超时内；不延迟模型或模拟返回。记录进入/延迟结束/原请求取消及目标安全元数据，不记录认证。
3. IAB人工进入原Work来源会话ses_-zURzTlJFzzacrP6FufN，展开原双Source。点击真实2:11引用，加载期间明确聚焦Main输入框，输入FOCUS568_DRAFT_ONLY，观察读取完成后实际焦点/截图；不编辑或保存文件、不发送输入。若焦点仍正常则如实排除候选，不为改动造失败。另看实际文件标题/内容/行带与3:15重复引用，按时间与当前控件重新取AX索引。
4. 若复现，先补齐具体触发、代码/实际输入输出与完整影响分析，再在现有唯一实现修复；纯UI不新增/修改/运行UI自动化。前端类型与Node完整构建到新私有publication；before先正常闭合和退休，再从其完整数据准备after，同慢读取条件实际复跑。需同时确认新输入焦点保持、原2:11/3:15定位继续有效，以及未转移焦点时正常引用仍可取得编辑器焦点。只读DOM用于位置/焦点诊断，最终以真实交互和已呈现截图复核。
5. 原来源文件另存完整bytes/mtime私有快照并在各scope关闭后验证保持，特殊空白同名Source只在原物理文件存在时验证。自有未发送草稿清空，关闭自有页，公开shutdown→join原exec→native/launcher/物理输出请求→全部源/目标数据/schema/config/完整性→原Provider EOF→成对退休auth/models。所有目标自然变化单独说明。
6. 更新本记录、当前文件焦点架构、真实图/安全证据与三索引/目录README，当前docs:check及直接相关检查；精确独立index提交，保留所有无关改动，fetch原完成→merge upstream→审完整待推集合→正常hooks push→fresh0/0。无版本/Release/tag或数据库演进，整体Goal继续active。

## 修改前实页复现与根因收敛

before原39766以正式main-D5Ah_P6W.js启动、两个Sol预检通过。第一尝试从来源到输入分成两次调用，01截图文件已加载，未取得加载期输入资格，不当成故障证明。原文件GET第一次02:00:40.047→02:00:48.048真实等待八秒。关闭已读文件、清空草稿后，同一次人工工具调用内点击原2:11引用、读取当前AX定位原chatTextarea并立即输入FOCUS568_DRAFT_ONLY；02实图明确显示文件仍“加载中…”且Main输入有键盘焦点。随后03真实焦点变为CodeEditor，草稿仍在Main但其键盘所有权被抢走。无模型业务输入或文件写入。

根因由真实输入/请求时序、前后焦点与代码共同确认：异步GET完成才挂载CodeEditor；原reveal只用path/range/revision与可见布局防过时定位，editor.focus()没有核对新焦点。把origin捕获放进CodeEditor mount也太晚，因为此时新输入已经取得焦点。必须在一直存在的FileEditorPane接收原显式reveal revision时记录原activeElement，跨读取传给唯一范围消费者。所有其他Artifact CodeEditor不传lineRange，按当前定义不进入该focus分支。这是共享文件工作台的UI异步交接，不是Task/Mission/Session执行队列、唤醒或终态异常；原Source/消息/运行事实不变。

最终实施方案：FileEditorPane的局部memo仅依原fileEditorRevealRevision捕获focus origin；CodeEditor显式split该展示属性，不传入DOM。原range计算、selection、行带和scrollIntoView保持，完成测量时仅原origin、BODY或该editor.contentDOM仍拥有焦点才focus。新的输入框或编辑器搜索控件不受抢占；同一编辑器contentDOM可继续接受它自己的明确引用。复用原组件lifetime、reveal identity与frame调度，无全局focus store、第二revision、observer重试、接口或持久化变更。保护范围是新取得的焦点所有者，不声称识别未改变activeElement的全部输入意图。

已查[CodeMirror reference](https://codemirror.net/docs/ref/#view.EditorView.focus)与[system guide](https://codemirror.net/docs/guide/)的官方搜索收录：focus明确转移编辑器焦点，requestMeasure负责测量读写阶段与requestAnimationFrame更新周期。直接抓取reference返回403，未冒充抓取成功；本实现仍沿当前已有requestMeasure/下一帧dispatch，不在measure write中另发同步更新。官方合同支持把范围呈现与是否交接键盘分开，不增加库或配置。

实施前已正常闭合before：公开shutdown200、39766原exec/原生/launcher退出0，physical/output/request完成，余901628ms；auth/models各退休1。2/4实际Sol请求流式200、原reader EOF。90表179748源原行/全部字段时间/字节mtime/schema5/canonical保持，目标仅两条原容量租约变化；另五个原物理来源文件全部bytes/mtime精确保持。自有234页关闭、草稿清空，未修改文件或发送消息。

## 修复后实页验证与限制

Node完整Vite构建得到main-i7S5rL3p.js，经原source CLI开发服务独立54054提供 `/ui`，未单独启动Vite。新after从已闭合before完整复制90表180183原行，schema5、原索引对象、完整性和canonical验证通过。配对完整auth/models，分别完成凭据、目标投影与真实gpt-6.1-sol流式预检。

02:11:51.388Z原2:11来源触发真实GET，02:11:52.208Z文件仍“加载中…”时在Main输入FOCUS568_DRAFT_ONLY；02:11:59.390Z结束8秒注入等待，02:12:05.485Z实际读取已呈现，编辑器第2行带和光标完成，Main209继续保有焦点。04/05实图直接复核，旧before相同条件则从Main320变成编辑器347。未发送草稿、未改写文件。

接着清空草稿，明确点击原3:15来源，编辑器正常取得焦点、第3行带可见；只读DOM光标left225.609/top52。再次点击2:11，第2行带与光标left147.609/top32.5正常。06/07实际截图复核。只读DOM沙箱不支持document.getSelection()，未取得原生selection offset，不以此推断内部API；归档实际可见光标几何和行带，原selection定位算法未改。旧首尝试01重命名为first-attempt-after-read，明确不合格时序，不把其当before失败证据。

冷读原source-reading/identity-422.md末尾U+00A0，加载期间焦点留在原Source按钮，完成后正常进入编辑器，原内容IDENTITY_LITERAL_NBSP_422；随后前导U+00A0 identity-423.md和普通identity-423.md分别呈现LEADING_NBSP/PLAIN两份原内容且均正常交接。08/09/10逐图查看，特殊空白文件身份保持。保护范围仍是新取得的焦点所有者，不声明处理activeElement未变化的所有用户意图。

after公开shutdown200→原97849退出0→native/launcher0→物理完成/输出排空/请求清理/原链dead_or_reused，auth/models各退休1，余1013451ms。2/4实际Sol请求全部流式200且原reader settled/EOF，全批4/8。before179748与after180183源原行、所有字段时间、库字节mtime、schema5对象/integrity及canonical保持；目标均只有两条原runtime_execution_capacity_lease的lease_id/owner_id/time_acquired/expires_at自然变化，Provider activity439→440→441。五个原物理来源文件完整bytes/mtime保持。自有235页面关闭、未发送草稿清空，用户18571实例未操作。

没有UI自动化测试、后端协议/schema/Provider业务改动、版本或发布。完整图与安全证据见[产物](../../artifacts/2026-10-24-source-file-focus/README.md)。`bun run --cwd packages/overlay typecheck`原41457退出0；Node完整Vite构建成功，保留原大chunk体积提示；`bun run docs:check`退出0，346 ops/26 groups，使用其既有隔离文档运行链。精确文件`git diff --check`通过。两次完整构建/类型检查的初次观测输出发生上下文截断，未把工具观测失败算产品失败；构建终端日志明确built，类型检查另取当前明确exit0。

交付按唯一当前分支main，以独立Git index仅收录本批文件和三README的本批索引行，保留171项原无关删除、两未跟踪目录与其他暂存。提交后按fetch原完成→merge upstream→完整待推集合审查→正常hooks push→fresh0/0执行，实际提交/推送证据由Git与交付回执提供；不预先宣称结果。整体Goal保持active，单agent继续后续批次。
