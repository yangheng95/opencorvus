# 演示文稿图表原生字号参数

## Recall

- 用户要求本人持续分批调查、先根因/影响分析并落规格、实际修复或功能改进、聚焦正向检查、真实桌面页面交互及截图人工复核、必要的精确流式GPT-6.1 Sol验收、范围提交、最新上游普通合并及正常推送，直到明确停止。禁止子agent（代理）、新线程、额外分支/工作树。现有凭据及完整模型目录已授权成对使用，模型请求不限，不刷新源凭据或记录秘密。
- 上轮5批已推送，最新 `b9710433551f0d38de9dcd067ceecd5de2376deb` 本地/上游/远端精确一致0/0、暂存空、原177条状态保留；见[收据来源错误记录](2026-11-27-work-artifact-receipt-source-error.md)及仓外receipt-source-error/delivery-result.json。run26原始句柄40230已join退出0，成对副本退役，不能重启同一label（轮次标签）。
- 已读当前04扩展合同、前五批Recall、PPTX（PowerPoint Open XML Presentation，PowerPoint演示文稿）作者结构/图表映射/校验/渲染/收据、唯一Tool（工具）声明、演示技能、生成器、真实原生资格与正式包资格。全仓查ChartElement/data_label_number_format和字号同语义定义/调用；仅presentation.ts拥有作者结构/映射，Tool与技能说明、两个原生资格输入为相关消费者；生成载荷是唯一技能源的镜像，不手工改镜像。没有产品UI（User Interface，用户界面）改动或检索到相关UI自动化测试，不新增或运行此类测试。
- 当前17个原项目文件、原自然会话、原件及所有旧交付保留。仓外 `opencorvus-iteration-20261127-chart-font-readability` 已保存177状态基线、固定上游源码、原生实验脚本/只读结果/原图；本Recall初次落盘时仅完成仓外实验，随后按下列方案实现。当前检查点：实现、原生测试、正式能力检查器和run27真实任务/三页桌面截图/下载均完成，原服务句柄95227已join退出0；待范围提交、最新上游合并及正常推送。恢复先读本Recall及下列执行结果，不重启run27。

## 现象、触发、根因及影响

- 本人前几批真实页面中看到业务图表的数据/轴标签远小于20pt正文；旧实际HTML（HyperText Markup Language，超文本标记语言）将金额28.25/7.35和笔数3/2写为SVG（Scalable Vector Graphics，可缩放矢量图）font-size=8，图表viewBox为518×332。作者计划仅能选标签类型与数值格式，没有数据标签/坐标轴字号字段，因而模型无法用原生图表计划直接表达展示所需字号。
- 这是两个需区分的事实：本批完成作者能力缺口，使原件能明确保存所选字号；固定上游渲染器还将OOXML（Office Open XML，Office开放XML格式）字号/100的pt（point，磅）数直接作为SVG数值字号，默认值也由其渲染器选定。增加作者参数不等于根治上游pt/像素换算或达到Microsoft PowerPoint像素一致，不能为补偿预览而暗中放大原件字号。本批保持当前唯一HTML渲染，不增加字体倍率、SVG重写或第二份图表实现；如实更正当前架构中过宽的“整页全部按物理pt”表述。
- 已查权威[固定setter源码](https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Core/Chart/ChartHelper.Setter.cs)及同一提交的[渲染器](https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Core/Chart/ChartSvgRenderer.cs)，不以滚动main文档代替当前包事实。前者已支持labelFont.size及axisfont，后者读取原生字号后作为数值SVG字号。直接通过原厂清单验证全部5个受管文件，OfficeCLI1.0.158在生产禁止更新/常驻的隔离环境中，对旧16259字节原件的自有副本设置标签18pt/轴16pt，实际成功；get返回labelFont.size=18pt、axisFont=16，两个原生chart XML均为标签sz=1800、两轴sz=1600，原金额/笔数与0.00/0格式保留。没有修改原件、示例项目或不可变附件。
- 原生实验确证可直接投影当前运行时，无需新增依赖或升级/重写包清单。Node.js/Chrome实际文件渲染保持三页1280×720，本人已看过第二图；字号选择在原件和预览均生效，但不将该文件实验冒充产品页面或模型端到端验收。
- 影响为所有Work/Task（工作会话/任务）共用的office.presentation@1作者入口、正式包资格与模型请求结构；DOCX/XLSX（Word文档/电子表格）当前作者没有相同图表计划，排除。原工具ID、原有字段及默认语义、图表数据、数值格式、几何、源/审阅图绑定、运行时限制和消息参与者保持原合同。无调度/队列/恢复/终态异常，不修改其机制。
- 两个可选数值字段进入现有单一作者计划，采用现有文本同样的8–72pt有限范围；直接投影真实原生属性，不接受原始命令、XML或任意配置对象。工具历史是原有开放输入记录，数据库/持久化结构及标准Office格式不变，无数据迁移或SDK（Software Development Kit，软件开发工具包）生成变化。

## 实施与验收方案

1. ChartElement增加 `data_label_font_size_pt` 与 `axis_font_size_pt`，有限数值8–72；映射 `labelFont.size` 与 `axisFont`。不设置时使用既有原生自动行为，不另建兼容层或自有字体推断。同步Tool描述、演示技能源及其唯一生成载荷、当前架构和正式包资格输入。
2. 现有固定原厂真实packaged-lifecycle正向用例指定18/16，原生get断言明确字号、原精度及真实系列值，继续完整校验/收据/正式交付。运行真实profile checker（能力检查器）进入正式包资格路径、后端类型、当前文档及架构检查；不新增UI自动化。
3. 当前开发模式 `/ui/` 启动独立run27，成对凭据/模型目录分别验证可用、投影与实际精确流式模型。本人发送真实业务任务：创建新名“销售经理简报-清晰图表.pptx”，保留旧17文件/所有历史和原业务事实，金额标签0.00/笔数0，图表数据标签18pt/轴16pt，三页完整审阅并正式交付、保存项目可编辑原件。模型自行使用当前真实工具，不做宿主路由或流程gate（门）。
4. 核对真实模型作者输入与原生XML、实际OfficeCLI输出、完整图、正式收据/产物/原件和浏览器下载一致；本人在真实桌面页面逐页截图看清金额/笔数、图表标签及完整正文脚注。原生Office编辑数据仍受首次账户向导阻挡，不操作认证/许可，不宣称其通过。单位换算的上游限制单独保留，不把可读性改进包装为像素忠实度修复。
5. 正常join（等待退出）原服务句柄、退役成对副本；根及相关README各加本批链接，脏索引精确暂存各一链接。范围提交、fresh fetch（获取最新远端）、普通merge（合并）上游、全体待推提交核对、正常hook（钩子）/push（推送）及远端/原177状态核对。不得发布版本、tag（标签）或Release（发布页）。

## 执行结果

- 已实现唯一作者结构和原生映射，Tool描述、技能源及生成载荷、正式包资格输入与当前架构同步；没有前端源码变更或新渲染路径。原生真实生命周期先因两个未识别字段失败，再在当前实现中通过1项测试/6项正向断言，原生get确认18pt/16及原值/格式。后端类型、`docs:check`、`check:architecture-index`、资格矩阵检查及真正 `check-work-artifact-profile.ts --profile office.presentation@1 --host-runtime-smoke` 均通过；没有运行UI自动化。
- 独立run27开发服务端口61964真实页面发起业务任务。精确Sol共21次流式请求，其中预检2、业务19；所有HTTP（Hypertext Transfer Protocol，超文本传输协议）200、实际源reader均settled/EOF（读取完成/流结束）。参与者为memory 2、chat 1、work 16、compaction 2，包含真实长历史压缩；压缩完成后work自然回复并以stop结束，实际只有1次author、1次deliver、1次write，不能以压缩中间摘要推断交付丢失或调度失败。
- 实际原件16266字节，产物`art_g0Vc8JddB00rifxkPyIl`，作者Tool Part `prt_g0Vc8IwHq00CzAGJqOhW`，交付`prt_g0Vc8JXWw0010zHtb7l3`。真实作者计划三页、两个独立原生柱形图；从实际压缩包读取两份chart XML，数据标签sz=1800、每图两轴sz=1600，金额0.00、笔数0，华东28.25/3及华南7.35/2准确，全部业务口径/退款/零金额/缺失事实均保留。项目新原件与附件/正式下载为相同字节。
- 模型实际读取全部3份1280×720新页图，正式交付与原validate收据逐项绑定同三份图片；自然交付Part绑定真实Tool Part。本人在真实Chrome `/ui/` 展开作品、翻到第1/2/3页并分别截图人工看过：标题、4张总览卡、正文和脚注完整；两张图金额28.25/7.35和笔数3/2可读，第三页两栏行动及事实边界完整。通过该作品下载菜单实际下载“销售经理简报-清晰图表.pptx”，检查唯一新下载与正式原件字节一致。没有以DOM文字、无错控制台或渲染分数代替视觉复核。
- 真实检查器 `check-delivery27.py` 通过：原17文件逐字节保留、原904行持久记录逐字段保留、示例项目HEAD仍f7bf091156c9b137c4eb3d5b822721294e9a8f24；只增加本轮新版本。记录及截图见[真实证据](../../artifacts/2026-11-27-presentation-chart-font-controls/README.md)。收集脚本首次遇到Windows终端cp1252编码输出错误，已通过Python UTF-8模式重跑原收集及检查器成功，未将工具故障当作产品结论。
- 原服务通过自有stop文件停止，原95227句柄join退出0，成对凭据/模型目录副本退役、61964端口关闭。未操作Office账户对话框，原生Edit Data（编辑数据）仍未验证；固定上游图表字号单位转换限制仍存在。没有版本/发布/标签变更。
