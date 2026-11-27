# PPTX 物理字号与最终审阅图绑定

## Recall

- 用户要求本人持续批次迭代到明确停止，禁止子agent（代理）、新线程、分支或工作树；现有Provider（模型服务）凭据及完整模型目录可用于精确流式GPT-6.1 Sol，模型请求不限额。每批完成根因/影响并落spec（规格），再修复、聚焦正向检查、真实桌面页面交互和本人截图复核、范围提交、获取并普通合并上游、正常推送。不能只写验收记录或伪称完成。
- 上批`50452a90f6f7635d05e13a20f9f6df5e7b8f57ac`已正常推送，远端/上游/本地精确一致0/0、暂存空、原177状态相同；中文PPTX（PowerPoint Open XML Presentation，PowerPoint演示文稿）名称与原生标签格式修复，32正向用例44断言，66次精确流式Sol请求结清，三页实际桌面/下载通过。证据见[上批记录](2026-11-27-sales-presentation-delivery.md)，仓外sales-presentation/delivery-result.json保存实际推送结果。
- 已读当前04架构、上批记录、presentation作者/验证/收据/最终交付、office-document两格式相同入口、office-html-render、Tool（工具）全部消费者、profile（能力配置）限制、binary-launcher内部入口、旧SVG（Scalable Vector Graphics，可缩放矢量图）光栅器及其5个文件渲染测试、原生PPTX/DOCX（Word文档）/XLSX（电子表格）资格链、固定OfficeCLI源的HTML/SVG/图表渲染。SVG到PNG（Portable Network Graphics，可移植网络图像）供PPTX验证、该测试文件及下述补查的真实profile checker使用，内部编译入口只供旧工作进程；共同HTML渲染已供DOCX/XLSX使用。未发现产品UI（User Interface，用户界面）自动化测试；不新增或运行此类测试。
- 当前主交付main，基线177个原有状态、源16259字节、精确16:9尺寸和32pt标题已在仓外`opencorvus-iteration-20261127-pptx-editable-data`保存。当前尚未修改产品源码。已有模型轮次及所有原件保留，后续仍使用同一自有项目/自然会话和成对凭据/模型目录，禁止源凭据刷新或写入秘密。
- 最新恢复点：下列分析在实施前落盘；当前唯一HTML渲染/三格式审阅图绑定已实施，11个聚焦正向用例38断言、真实profile checker、后端类型、Sol旧收据错误→新图审阅→交付及三页桌面/下载已通过。run22原句柄已join退出0、成对副本已退役，不得重复启动该label。下一步只剩范围暂存、提交和正常上游同步/推送；实际推送后的核对写入仓外delivery-result.json，需先检查Git事实，不能把此提交前检查点当成未执行服务或直接重跑。

## 现象、触发、根因与旧路径缺口

- 已将上批正式原件逐字节复制到自有临时目录，从原先未运行的PowerPoint启动独立检查。真实PowerPoint打开3页，没有文件修复对话；本人已看到第一页与104%缩放。标题和正文比网页审阅图明显更大。随后Office首次启用/账户向导遮挡工作区，“编辑数据”尚未完成；按computer-use技能引用的禁止自动操作认证对话框规则停止该部分输入，不把此向导当作产物或模型缺陷，也不点击认证/许可动作。未操作用户原先正在使用的Office文件。
- 精确源事实：`p:sldSz`为12192000×6858000 EMU（English Metric Unit，Office长度单位），标题`a:rPr sz=3200`为32pt。固定上游SVG把EMU除6350导出1920×1080像素坐标，外来XHTML（Extensible HyperText Markup Language，可扩展超文本标记语言）仍写32pt；本地旧光栅器按1280/1920将Pango（文字排版库）dpi（dots per inch，每英寸点数）从96缩为64，32pt最终约28.44像素，物理1280宽的13⅓英寸幻灯片应为96dpi的42.67像素。图形几何缩放被重复应用到独立物理pt字号，正文/标题/脚注均受影响，字框高度和换行审阅因此失真。数据与原件字号没有被改小。
- 旧修复只保证不同字框高度不改变字号，并测试栅格中有文字/资源上限；没有将源OOXML（Office Open XML，Office开放XML格式）物理字号、尺寸与真实Office/浏览器HTML对照。简单固定乘1.5仍绑定某份SVG坐标假设，不能根治单位混用。固定[OfficeCLI HTML源](https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Handlers/Pptx/PowerPointHandler.HtmlPreview.cs)直接由原件物理pt生成幻灯片及文字，已有共同浏览器渲染primitive（基础组件）可复用。
- 仓外原生试验先验证固定宿主全部5个受管文件与原厂不可变清单匹配，再以生产隔离环境/禁止自动更新和resident（常驻实例）运行`view html`。实际HTML44506字节；Node.js25.7.0/Playwright1.59.1/Chrome157.0.8103.38完全离线渲染，移除脚本/事件和界面导航，仅保留真实slide。获得三张1280×720图片；本人全部看图，32pt标题及正文/脚注恢复实际物理字级，两张分开的原生图表仍显示28.25/7.35与3/2，第三页完整。首个Node ESM（ECMAScript Module，脚本模块）绝对Windows路径需file URL，已修正实验运行器并重跑，不能用其失败代替资格验收。此为原生文件实验，不能代替产品桌面和模型端到端验收。
- 追查渲染变化的最终交付合同发现共享缺口：PPTX的最终解析会重新校验/渲染，但只核对旧审阅附件自身URL/摘要；DOCX/XLSX也仅比较源、runtime（运行时）、renderer（渲染器）版本和页数后验证旧附件自身身份。两处均没有比较本次新PNG与已审阅PNG。代码或字体变化但源/运行时身份不变时，可交付未经新审阅的图片。旧哈希核对确实证明原附件身份，却不能证明新页图与该审阅相同；不能用“上轮成功”排除此共享根因。
- 影响横审覆盖全部三格式、Work（工作会话）和Task（任务）共用typed Tool入口、直接原生资格消费者、自然收据Tool Part来源核验和最终实际附件/交互产物。Table/Report（表格/报告）应用原生投影没有此文件重渲染路径，排除。当前没有调度、队列、唤醒、恢复、并发或终态异常证据；不因此修改Task/Mission/Session（任务/编排/会话）状态机制。
- 首轮检索集中在src/test，删除旧函数后的全仓补查发现`script/check-work-artifact-profile.ts`也直接调用旧SVG函数；目前该调用必须同步修正，禁止保留旧导出或跳过真实checker。它在自有临时目录检查真实指定PPTX，不具有自然Session，原先也使用host进程权属。因此内部纯文件`renderOfficeHtml`可接受现有`BrowserNodeSidecarAuthority`的真实host权限与原有Session权限，仍通过唯一显式Node执行器；不伪造会话/消息。生产Tool继续传原Session执行权属，Task仍映射task进程，不新增LLM路由或host旁路。checker改为同一HTML渲染和逐图原生PNG检查，并保留其后必跑的完整typed生命周期。

## 实施方案与公共合同

1. 将PPTX验证切换为同一固定OfficeCLI的完整HTML，复用现有`renderOfficeHtml`和显式Node浏览器sidecar（辅助进程），让浏览器按源物理CSS（Cascading Style Sheets，层叠样式表）单位排版。共同渲染器新增内部pptx格式分支：离线、脚本和事件不执行、只保留真实slide节点、移除界面导航/缩放；字体和嵌入图片就绪后逐页截图。保持现有页数/像素/输出/时间/取消/项目权属限制，按真实16:9画布生成规定1280×720完整页图，不把无效比例拉伸为合格图。PPTX不额外生成或宣传PDF（Portable Document Format，可移植文档格式）。DOCX的Paged.js及XLSX表格布局和PDF合同保持各自当前实现。
2. 删除被替代的Pango/SVG文字光栅器、内部专用编译入口/环境标志和5个仅服务它的旧原生文件测试。它们是此次替换后不可达的同一能力，不扩大为无关清理，不保留后备实现。所有定义/调用已搜索；公共Tool ID、作者字段、源字节、API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、数据库结构和持久数据格式不变。
3. 在已证明重复的两个最终交付实现中使用一个最小共同审阅图绑定函数：新完整、有序PNG的规范URL及内容身份必须逐项匹配已审阅收据，才返回本次真实引用；差异映射为明确的重新校验/审阅错误。继续验证旧不可变附件的真实身份，禁止以新写的期望摘要自证正确。PDF元数据中的生成时间可变化，不能把字节不同等同于可见页面变化；该通用约束针对实际审阅的全部页图，DOCX/XLSX现有runtime/renderer/源/PDF自身身份合同保留。不能伪造旧收据已经审阅新图。
4. 当前收据schema（数据结构）不变，无需迁移历史附件或数据库；历史源、收据、图及交付记录原样保留。因新渲染得到不同页图的旧收据会得到明确错误，用户可自然调用现有validate（校验）、看新图再交付。host（宿主）只实施不可变审阅数据完整性合同，不教模型选工具或增加流程gate（门）。
5. 更新当前架构、必要的Tool说明/技能及唯一生成载荷，说明最终交付必须与完整实际审阅图片一致。若技能源未改变，禁止无理由生成并提交镜像。所有新记录/产物更新根/相关目录README索引；三个原有脏索引只暂存本批各一链接。

## 验收与交付

- 非UI聚焦正向合同测试：同一有序审阅图集合返回明确的新引用；发生首/中/尾图变化、顺序/页数变化时映射到明确错误。测试只检查协议/数据和真实错误，不增加“不调用/不存在”等负向核心断言。源PNG真实不可变身份属于有效完整性验证，不检查可变源码摘要。
- 三格式固定宿主真实作者/校验/收据/最终交付回归，PPTX含中文名称、两位金额原生图和嵌入图片；DOCX含分页标题/长正文、XLSX含数字/布尔/中文。覆盖实际新HTML路径及既有两格式，聚焦原生checker，不运行产品UI自动化或无目标全量测试。
- 真实Sol新轮次使用原会话/同一16259字节原件：先尝试沿用上批真实收据交付，依据实际错误自然重新校验、读取全部新PNG、正式交付；保留失败历史。需要证明源/原有文件/原有自然历史不变，规范原件/项目保存/真实浏览器新下载一致，最终页图与本轮已看图逐字节相同。不能把模型自述作为看图或成功凭据。
- 本人启动当前开发服务`/ui/`，进入新交付卡、逐页切换并截图人工复核物理字号、换行、图表单位/精度、第三页完整性和实际下载。无产品UI源码改动，也必须通过真实页面验收。PowerPoint数据编辑仍因启用向导未知，不能宣称原生“编辑数据”完成；本批不以此阻止可以独立验证的预览和收据修复。
- 后端类型、文档/架构检查及正常push（推送）钩子通过；范围提交后fresh fetch（获取远端最新代码）/普通merge（合并）upstream（上游），审查完整待推集合，正常推送并核对远端和原177状态。禁止rebase（变基）、强推、跳过hook（钩子）或发布/tag（标签）/Release（版本发布）。未满足项精确列出。

## 实施与验证结果

- PPTX真实验证已使用单份OfficeCLI HTML及共同显式Node浏览器渲染，保持自然CSS物理pt、完整1280×720画布和全页图片；PPTX分支只生成PNG，DOCX/XLSX仍保留当前PDF。旧295行SVG/Pango工作进程、内部编译环境入口、97行/5个旧原生SVG文件测试一并删除，未运行旧测试，没有兼容导出或后备路径。补查的profile checker已同步进入相同HTML渲染，真实host权属不冒充会话。
- 三格式共用`reviewedWorkArtifactRenders`：完整有序新引用与原收据逐项匹配后才返回；差异为明确fresh-review错误。保留已有源/运行时/不可变旧附件验证。8个正向协议用例8断言通过，身份来自实际生成的四张16×16不可变PNG；覆盖原引用输出、首/中/尾图变化、其他规范引用、顺序和页数到明确错误。没有用占位摘要或可变源码摘要证明图片正确。
- 固定OfficeCLI1.0.158三格式原生资格：PPTX中文名/两位金额图/嵌入图片完整typed生命周期1用例4断言；DOCX原生分页/文本及XLSX单元格/表完整生命周期2用例26断言，通过。加共同协议用例共11个独立用例38断言。Word链底层输出两条TT字体解析warning，日志原样保留，内容/分页及原生正向契约通过；不写成日志全静默，也不以日志代替看图。
- 实际`generate-work-artifact-qualification-matrix.ts --check`及`check-work-artifact-profile.ts --profile office.presentation@1 --host-runtime-smoke`原始句柄正常退出0：当前目录/工具声明、实际原厂闭包、原生HTML页图与完整source typed收据/新鲜交付链均进入真实checker。后端类型、docs:check353操作/26组、architecture-index20文档通过。共同生命周期技能和Tool说明同步了精确新图绑定要求，已用现有生成器更新唯一builtin载荷。
- run22实际开发服务58264，先分别验证复制凭据可用、完整模型目录投影和实际请求精确openai/gpt-6.1-sol，再由本人从隔离Chrome真实页面发送保留原件的用户请求。自然旧收据尝试`prt_g0Vc7zg3400VMdvW6Ywq`使用真正的旧validate Tool Part收据a63fe90…，得到明确`Final Work Artifact render 1 differs from the reviewed validation receipt; validate and review the fresh renders before delivery`，自然错误分类为tool-execution/Error。不是来源错误、目标模型未投影或凭据缺失。
- 模型随后自然重新校验同一源、读取全部三张新原图、只读核对原件字号/字节，再以新收据正式交付`art_g0Vc809nl00seAgJAcFe`，消息自然stop。源URL仍为57cd5ff5…pptx，16259字节；完整三页16:9、所有计划文本、两个原生图表及金额0.00/笔数0格式保持。新图1fe55178…、4e5ea60a…、50d34f10…与本轮实际validate审阅图、正式Tool附件、交互产物及最终收据逐字节/引用一致；没有重新作者或改写源文件。
- 本人实际打开新交付卡，展开并切换1→2→3，逐页截图看过：标题/正文/脚注恢复物理字级，退款−2.05及零样品、区域合计及分开的两图28.25/7.35与3/2、第三页事实/缺失数据/核对行动及完整页脚均可见，未见裁切。菜单仍显示准确中文原件名及三张新PNG。本人从菜单实际点击下载，新下载16259字节与项目保存、规范源相同；浏览器原件不因预览变化而改写。
- 独立文件/协议/历史checker已通过，15个项目文件（含README、Git属性/忽略文件和项目配置）逐字节保留；808条原会话记录（message147/part393/request130/outcome130/artifact8）逐行原值保留，示例项目HEAD仍为f7bf091156c9b137c4eb3d5b822721294e9a8f24。完整旧收据失败、后续新validate和实际图像读取、最终成功均保存自然工具结果。checker最初将API错误字段误认成error，已按真实`state.failure.message`修复并重跑原检查通过，不将运行器KeyError当作产品故障。
- 本轮12次请求：10业务/2预检，全部精确Sol、streaming=true、HTTP200、reader settled/terminal EOF；run22原启动句柄16080正常join退出0，自有端口关闭，凭据与完整模型目录副本退役。未修改源凭据或记录秘密。当前剩余交付步骤为范围提交、fresh fetch/普通上游合并、完整待推集合核对及正常hook/push；推送后的真实远端/状态以仓外delivery-result.json及Git为准。

## 未满足的原生 Office 体验边界

- PowerPoint真实第一页已查看，源文件可打开；“编辑数据”仍被Office首次启用/账户向导阻挡，没有点击认证、许可或切换账户。不得把原生chart XML等同于该桌面编辑器已验收，不上传含账户的向导截图。该项需要手工完成向导后另行继续；本批的物理预览和三格式审阅图绑定已有独立完整证据。
- HTML/本地字体不宣称Microsoft PowerPoint像素一致；原生图表自动字号仍由上游决定，本批修复的是源物理pt与自有光栅器的单位错误。系统生成的“Rendered slide”预览辅助名称仍是后续本地化线索，本批没有修改产品UI源码或扩大多端验收。
