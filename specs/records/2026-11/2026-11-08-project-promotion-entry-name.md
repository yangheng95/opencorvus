# 匿名项目转换的宿主名称准入

## Recall

用户要求持续批次迭代，先根因/影响分析落spec（规格），真实桌面UI（User Interface，用户界面）/UX（User Experience，使用体验）交互/截图人工复核、聚焦正向功能测试、范围提交/普通merge upstream/正常push后继续，直到明确停止。最新明确纠正为“不要用子agent，你自己工作”：两位正在运行的子agent已立即interrupt，后续本批全部调查/实现/复核由主agent单独执行，不再委托。此前已收到的只读历史证据仅作线索，不冒称本批独立复核。

b23 030f947be已正常push，所有钩子通过/密钥扫描0，主修复真实英中Move/搜索/rename/取消/409/编辑器原文已验；空物理目录搜索缺口已确认但未修。本人页面48/49/50和服务93884/56970/32902均正常退出0。开始main/upstream0/0、原177状态保留/暂存空。Sol凭据授权仍未答，不重复问，不读取/使用凭据/模型目录，不发模型请求。Page上下文为null，不涉及Page写入。

已由主agent读取File.assertEntryBasename及create/copy/move/upload调用、ImplicitProject.PromotionInput/promoteOwned验证到beforeMove/journal/准入/复制/回滚完整链、原PromotionError及b21公开错误合同/真实匿名allocator、ProjectLedgerGroup唯一转换错误摘要与当前Dialog归属、i18n加载、现SDK ProjectRelativePathSchema、util包导出/依赖、当前02-data/07-panel相关合同。全仓同语义搜索命中SDK portable path、office-document、skill market与场景输入device regex，不能盲套更严格的可移植全路径规则或逆向导入File。现File与Promotion均可依赖现util包，不增加依赖或循环。已查[微软文件/目录命名一手文档](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)：普通问号是保留字符，尾点与设备名规则单列，不能预判Bun/底层文件系统具体失败或别名行为。

## 修改前根因、影响与未知

候选现象：匿名转换使用普通Windows非法名称named?project，没有早期领域invalid_name而晚到物理发布报错；实际status、原cause、回滚和源/Project身份尚未知，先实证。直接触发是合法父目录+单段但宿主不允许的name。File已有单一私有assertEntryBasename，拒绝空/点段/路径分隔/NUL及Windows非法字符、尾点/空格、现ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）设备名规则，create/copy/move/upload复用；Promotion只拒绝点段/斜杠/反斜杠/NUL。数据流先beforeMove释放实例，再record/maintenance fence/隔离复制/rename；旧b21只修声明，不能根治准入缺失。

若实证成立，方案把原宿主叶名称判定纯化到现util的entry-basename模块，显式传Windows语义、不绑定Bun/Node全局。File与Promotion只引用这一事实来源；File保留原错误类、字段和诊断message，Promotion保留原invalid_name/原点段message并在beforeMove之前使用同宿主判定。现path.isAbsolute在已拒两种分隔符的basename判定中冗余，抽取时以原正向合同证明等价，不加第二套规则。新的shared helper可返回明确issue类别，由领域owner构造原错误，不复制错误payload/schema。

本批不更改持久结构/数据库迁移/模型/消息/执行和恢复机制。合法名称、当前trim、大小写和Unicode身份保持；POSIX（Portable Operating System Interface，可移植操作系统接口）可用的宿主字符不被便携协议收紧。SDK portable全路径还管NFC（Normalization Form C，Unicode标准组合规范化）/首空白/全平台字符，它与普通宿主basename是不同合同，不作为替代。官方设备规则包含上标数字，现多处旧ASCII设备规则存在另行统一审计范围；本批先保留现File策略边界，不进行设备名文件操作、扩展便携市场/Office策略或无关清理，已知差异明确列出。

UI体验同步调查真实转换失败的可行动摘要。现ProjectLedgerGroup只有OwnedPromptControllersError409专用本地化，其它情况通用“未能确认操作结果”+原Details。若after明确400 AnonymousProjectPromotionError/reason=invalid_name，在当前转换owner内以结构化错误合同提供当前语言具体名称提示，保留原Request ID/Details、Dialog焦点与scope/取消/成功流程；只针对已证字段，不按错误文本/关键词分流。其它reason不猜测是否提交，不泛改摘要。先完成真实前态证据后再定稿。

风险：扩大命名规则、改变File/Upload错误契约、坏输入实际进入移动/回滚、不当用mock冒称端到端、原项目字节或身份被误动、晚回执抢新作用域。分别以原实现逐分支/旧决策、纯issue正向样例、真实HTTP（Hypertext Transfer Protocol，超文本传输协议）和当前项目完整事实/原文、正常成功后原ID、真实页面中英与原owner保护验收。若真实调度/队列/唤醒/恢复/并发/终态异常出现，立即按共享Task/Mission/Session occurrence（执行轮次）全横审；普通输入错误的正常rollback不预判为这些异常。

## 验收与隔离输入

本人Temp opencorvus-iteration-20261108-b24，fresh profile-before/after、自有Git项目/父目录/私有Git配置。dev38966/38967 /ui，before现main-Dz-yHp9q.js，若UI改动再普通build后after，不单起Vite，不操作用户进程/窗口。正式POST/global/projects/anonymous201创建本批匿名源，公开File写本人固定原文；只在本批profile/data/projects内源和本人目标父目录操作。

before对照同普通非法名File.create directory的明确400，再promote named?project真实回执/原cause/公开Project/物理源原文。异常若产生正规promotion journal，仅读取必要终态/原身份事实，不用标题或最后错误猜根因。随后通过真实UI改合法name成功，核同Project id/原文件；不试设备名/尾点物理别名。after同坏名应400 PromotionError/invalid_name与原Project/原字节，界面中英具体摘要/原Details后重新输入合法name200成功。纯设备/控制/点段规则只在纯函数正向issue测试，不做文件操作。

非UI新聚焦正向测试先红再改：真实匿名/FS/HTTPtyped400及合法200身份/原文，现File/Upload明确错误响应/纯helper各issue与可用宿主Unicode样例。按实际影响选原file mutation/promotion合同，不全量bun test、不负向核心断言、不UI自动化。真实checker与页面分别标边界。Backend/util/必要SDK类型、普通build/语言键/renderer、docs:check/architecture-index辅助，不能替代截图。资源正常shutdown/原session退出0、原177状态/三README本条、范围commit/fetch普通merge/待推全集检查/正常push后继续。

## 修改前实证与实施定稿

正式匿名prj_hbBT0qNzrEBFhQZnDL26，源38字节identity-note.txt。File.create named?project目录明确400 FileInvalidPathError；同名promote真实500 UnknownError，Request ID f80b8aa9-b7f4-4240-926b-1a1b6288cf23。只读原日志精确定位staging→named?project最终rename的ENOENT，prepared已产生，真实terminal ce07eb05-1189-42c7-92f7-1d6ee4acdf5b为rolled_back；完整公开Project record和原38字节相等。根因为坏宿主basename被准入到物理发布，不能根据ENOENT标题误判缺父目录或凭据。正常回滚/身份恢复有原持久事实和真实reader证据，无调度/队列/恢复未收敛异常实证，不改这些机制。

真实IAB51/main-Dz-yHp9q.js再次同坏名500，通用Couldn't confirm the action摘要和原Request ID 3a5e047d-9a61-4e88-8c97-f37cc726260a（01）；关闭后重走菜单合法b24-ui-before-promoted成功（02），公开Project id及38字节保留，页面正常命名项目。两图实际呈现人工查看，服务正常shutdown；所有操作本人隔离输入，未调用模型/凭据。

实施定稿：新util/entry-basename纯函数classifyEntryBasename显式返回valid/empty/path/windows-invalid/windows-reserved，显式windows布尔，使可用名称也有明确正向输出；原File私有wrapper只转换为原File/Upload错误和原message。Promotion在原匿名source判断后/beforeMove前用同函数，empty/path保持原“Project name must be one directory segment.”，Windows分支给明确宿主名称诊断，原reason invalid_name/字段不变。不扩大原ASCII设备规则，不新增便携NFC或全平台字符限制。

前端只在当前promote owner且真实HTTP400、具名AnonymousProjectPromotionError、data.reason=invalid_name三者同时成立时，现Dialog使用两语具体名称标题/重试说明；原body/Request ID/Details和returnFocus/openingGuard完整保留。409后台活动和其它错误沿原摘要，不按文本判断。补正向真实typed400/正常成功与原File四入口错误契约，纯helper问题分类，随后真实新构建英中失败→合法名成功验收。主agent独立执行，不启用子agent。

新聚焦checker先误用了不存在的/file/copy路由，JSON解析失败；已从生产FileRoutes核对并修为/file/item/copy，此工具输入错误不算功能红证。重跑真正红0pass/1fail/5filtered/10断言：create/copy/move/upload原400错误与精确message均通过，在promote期望400 PromotionError/invalid_name处得到500 UnknownError。两个失败测试runtime均按runner保留诊断、物理/output结算true。产品尚未修改时取得该有效红证。

## 实施与验收（本地时间跨至2026-11-09）

File原规则已抽到util/entry-basename的单一纯分类，File仅保留领域错误映射、原类/字段/message；Promotion在原位置复用分类并早期invalid_name。原便携SDK/市场/Office命名合同未扩改，既有ASCII设备字形范围明确保留为后续项。ProjectLedgerGroup只从原结构化400+具名+reason匹配本次名称错误，两语新增2键，原reportError/Details/Dialog归属保持。没有新schema、依赖、配置、数据库/持久格式或恢复算法；OpenAPI/SDK生成内容无需变，docs:check保持352ops/26groups。

主agent独立审阅全部差异，确认原File逐分支/顺序与错误完全保留（isAbsolute已被双分隔检查覆盖），Promotion保留点段旧message，新增宿主诊断不改reason；UI的409判断、其它owner和异常payload沿原通用摘要。纯分类25pass35断言（设备名仅纯分类）；真实checker Promotion6pass93、File4pass124、历史source2pass13，共12pass230；合计37pass265。新Windows用例证明File四入口错误精确保持、非法问号和尾点typed400、原完整Project snapshot/原文、随后合法200身份/原文。POSIX只以纯分类证明原字符范围，不冒称本机真实POSIX端到端。

Backend/util/overlay类型、util build、两语言2923键、普通UI build78秒和renderer public surface、docs:check/architecture-index均通过。after真实TCP38967匿名prj_hAzpNpaYiJ1BmYUsccJt，普通坏名400 AnonymousProjectPromotionError/invalid_name（3ac4a23c-250b-4766-a59b-62bd1684916b），完整Project/38字节一致。新匿名目录按实际跨日进入2026/11/09，不改旧路径日期或重写记录日期。

真实IAB52/main-DOreZipN.js英文坏名显示Invalid project name和具体重试说明，原Details请求aa123922-897a-407c-a901-8da9ade2892a；中文重新触发显示项目名称无效，原400请求574eec7d-87a0-480e-afb4-0af278388332。两次关闭均原匿名Project BUTTON持焦。语言菜单后hover操作按钮未呈现时，先实际项目行Tab自然进入“项目操作”，未用强制click或注入焦点；一次旧定位失败仅为当前可见入口变化，不当产品故障。两次UI错误后完整Project snapshot和38字节仍同初值。

中文合法b24-ui-after-promoted成功，原id保持；05/06实际命名页与文件面板原文，公开文件200和物理原文逐字相同。01—06全部截图人工查看。before源prj_hbBT0qNzrEBFhQZnDL26在两次真实500正常回滚后也已合法成功/原字节保持，不对普通失败终态作调度异常猜测。

尚未覆盖实际POSIX文件系统、额外官方设备字形跨portable消费者、改后409后台活动/其它错误页面（仅原代码判断等价和HTTP controller合同）、Provider/Sol端到端；零模型/凭据。b23物理空目录发现缺口仍未修。本人IAB51/52关闭，before68707/after66411均正常POST/shutdown且原session退出0。本批全程遵从用户最新要求单人执行；结束按原177状态、三README本条、范围提交/上游合并/正常push收拢，再单人继续。
