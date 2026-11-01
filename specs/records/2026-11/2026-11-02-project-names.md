# 重命名项目的统一显示（885）

## Recall

用户要求只用单agent（代理）持续自主排查并改进UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，实页验证后提交推送，不操作正在使用的窗口。旧Goal的三Astra文字已被后续单agent要求覆盖，不委托。上一轮为实质进展：4ae1a6fd5bdfdfc26c80641fdb3bc8f7f9e43f78已推送，fresh HEAD=origin/main、0/0；884-final schema9/92表、258693行、100项目、229附件，原句柄92375 exit0、shutdown200/物理输出请求与出生身份结清、配对副本退休，累计1260模型请求。本轮初始177项无关删除/共享索引/缓存保留，无产品改动。

新发现：源数据库已有三个与目录basename（末段）不同的真实项目名称，含Project journey 773（stream-stop-755/project）及两个home-files项目。首页Conversation和侧边栏使用canonical Project名称；MissionBoard及MissionCreate只给现projectLedgerDisplayName传目录，没有传customName，故用户按自己已改的名字查不到或看到另一名字。884的查询是从既有显示标签/路径匹配，不产生项目名元数据。

验收：统一使用已存在的workLedgerProject(directory).title读取入口，名称原文、真实目录与匿名后缀合同保持。命名项目在首页、创建选项/选中值、看板筛选与卡片一致；按自定义名称和真实旧目录都能查到同一项目，中英文及长名称保持可读。保留请求草稿、取消/未明确选值行为及884的Esc合同。after在本人隔离数据中实际通过UI保存一份明确未执行的手动Mission草稿，检验保存目标目录、显示名、过滤与卡片；不调度/启动任务，不调用模型。

已读：根AGENTS.md；884 Recall/29图/最终资格/fresh推送；07-panel命名/项目身份/项目GET与名称PATCH及Mission board合同；main项目目录列表与唯一MissionBoard调用；MissionBoard/MissionCreate标签、搜索、目录值和createDraft回调；Conversation首页与ProjectLedgerGroup、CommandPalette显示名调用；work-ledger唯一runtimeRows、runtimeRowsRevision、workLedgerProject读取和WorkLedger完整分页原子更新；projectDirectoryKey、projectDisplayName/projectLedgerDisplayName现实现；Mission draft客户端、POST /mission/draft、mission session持久创建和projection、Session持久化写入。全仓搜索现读取入口只有Conversation及定义，两个遗漏消费者已确认；产品字段没有新UI自动化测试。

## 修改前分析与边界

- 现象数据：真实Project记录name与worktree已不同，且Sidebar/Home公用读取可展示。885实页尚未知，先复现；不能把目录字符串或旧图片当完成证据。
- 根因：数据和公共GET已有名称，显示调用漏传customName；不是项目注册/目录选择错误，也不需要新后端搜索、名称缓存或平行配置。旧883/884解决目录身份和输入查找，未给旧projectDirectories接口补回现名称owner。
- 实施：只在两个组件调用既有workLedgerProject并将title传给现格式化函数。MissionBoard统一missionDirectoryLabel，因此筛选排序、标签/搜索和卡片都跟随同一名字；创建options同理。保留directory作为值、parent及全路径、隐式项目既有后缀与当前语言。无需修改main类型、reader服务、公共接口、数据库或名称规则。
- 共享数据流：runtimeRows读取追踪revision；WorkLedger完成全部分页并核对authority后才一次替换，不在普通refresh开始时清空；authority退休仍清空，不能跨连接复用名称。此次仅消费现单一事实源，不增加旧名fallback（后备路径）、影子状态或生命周期分支。
- 影响：两个字段、自定义项目名搜索、所选上下文与已有卡片；搜索仍包含原路径，不以自定义名改变目录身份。原创建默认、草稿、Squad上下文请求序列和权限保留。现匿名目录显示规则不改；不把注册名当作UUID身份或改写用户名字。
- 风险：同名自定义名仍需路径；长名截断/菜单或模态越界；名称更新后选项的值/索引错位；未加载项目只有默认目录标签（既有可选名称语义）；保存草稿可能触发项目bootstrap元数据变化，必须实测并追证，不直接豁免旧行。
- 真实手动草稿：当前POST /mission/draft只解析输入、固定Squad快照、持久创建一个Mission Session、标题与pending operator prompt（待执行原请求），公开合同明确到dispatch之前不调用模型。保存一份题为项目名称验收885（未执行）的草稿到既有Project journey 773，随后只读取看板/公共API（Application Programming Interface，应用程序接口）并核对持久事实；不按Start。真实POST输入由现TestHooks记录并脱敏，公共GET核对backlog、标题、原请求、目录和身份。该记录只新增在本人after副本，原数据库/旧业务行与所有项目文件必须保留；若旧数据因合法元数据路径变化，先调查真实调用和差异再决定，不添加宽泛排除。
- 非UI算法/后端/持久格式/schema（结构）、Provider/LLM（Large Language Model，大语言模型）/工具、Task/Mission/Session调度轮次/队列/唤醒/恢复/重试/终态不改。手动草稿的现生产路径只作为验收；若出现调度异常立即按共享机制横审全部生产入口及串并行/多项目，不归因模型。无版本更新或Release/tag/PR。

## 首次资源与顺序

before/after首次各0模型请求。首次prepare前声明75分钟共同绝对截止，预留5分钟闭合，不加额、不续期、不重启旧阶段。源为884-final完整258693行，复制/保护100旧项目业务文件与Git及229附件；原认证和完整模型目录成对复制/验证/退休，不输出内容。before复用884实际main-B6mbMiSX.js和成功receipt；after用Node.js构建。本人后台项目CLI（Command Line Interface，命令行接口）开发/ui/端口38589/38590，不碰用户18571及其他窗口。

1. before实际通过命令面板找Project journey 773并进入现首页，随后打开创建字段，对照名字/目录，查询同一自定义名及原目录；查看另两个现存别名。不改名、不提交业务。实页截图人工复核，正常退出/public shutdown200/原句柄exit0/物理输出请求及出生身份结清/配对副本退休/完整旧数据资格后再改产品。
2. 两个UILabel调用补齐现名称读取并同步07-panel，不新建状态/算法/配置。纯UI不新增、修改或运行源码文案/DOM（Document Object Model，文档对象模型）/组件/快照等任何UI自动化。
3. after实页中英文、三真实名字/旧路径及长名、草稿保留/取消；实际保存一份未执行的手动草稿至命名项目，截图核对卡片/筛选；公共API和持久事实复核实际输入/目录/标题/原请求/状态及全旧数据。辅助build/typecheck/i18n/CSS（Cascading Style Sheets，层叠样式表）/docs不替代视觉。
4. 正常闭合与配对副本退休；完整旧业务行、源DB、100旧项目文件/Git、229附件、原认证/模型目录资格。三索引同步、仅本轮文件提交；fresh fetch/普通merge、完整待推集合复核、正常hook/push与fresh同步。持续Goal保持active。

## 实际证据

### 实页发现的同一创建窗口排版问题与实施前追加方案

after真实保存草稿时，11/13图可见专家团说明与下一行名称重叠。只读实页几何显示列表max-height 240px，每条Checkbox根flex-shrink=1、实际高度36.8px，而label及scrollHeight均56px；单独安装按钮24px。直接触发点为Work类型加载5个带长说明的真实专家团，使纵向flex总本征高度超过上限。根因是mission-create-form__expert-squad-list允许子项收缩，Checkbox共享最小高度24px使收缩下限低于当前多行内容；overflow在文字子项上向外绘制并叠到下一项。旧样式只将Checkbox顶部对齐，未保留其内容高度。不是模型内容错误、滚动失效或名称查询问题。

已读Checkbox primitive和selection-control.css、MissionCreate完整For/Show生成、mission-board.css列表/选项/按钮、全仓相同class及Checkbox调用。当前列表和选项class只有本创建窗口生产消费者；通用Checkbox还有Goal/文件审阅/交互卡片/邮箱/能力设置等消费者，不改共享primitive，避免影响它们。方案是在该列表现有Checkbox与安装按钮规则中分别设flex-shrink:0，保持现240px边界和overflow-y:auto，由真实行内容决定高度；不改名称/选择/状态/请求、后端、数据、schema或调度。长说明仍原文可读，目录和名称保留，本次无接口/函数/配置变化及非UI逻辑，无UI自动化测试。

先正常关闭after并严格资格，再构建final；新final首次0模型请求，仍沿最初共同绝对截止和5分钟闭合预留，不续期、不重启after。final基于after完整保留真实草稿，实际中英文复核说明行、列表上下滚动及安装入口可达、Base/Dynamic标签与键盘选择、筛选缩短列表与查询草稿保留；读取真实草稿API验证，最后正常闭合/资格/提交推送。

before真实页面01–05已复现：首页Project journey 773，创建选中值project；输入自定义名无结果，stream-stop-755返回原目录项目及匿名项目。另两个home-files项目也只显示原目录末段。原服务public shutdown200；原runner的child close结果27320 exit0已读取（执行工具的外层session编号在上下文截断中未保留，不伪称已另行poll该编号），settle核对原native/launcher exit0及出生身份/物理输出请求结清；未重启或替换服务。配对副本已退休。资格before保留全部258693旧行、100项目文件/Git、229附件和源DB/原认证目录元数据；仅新增两条本阶段运行lease，0模型请求/累计1260。

after 07–10实际查询三个真实名称及旧目录，长名称原文仍作为完整控件值、菜单保持省略和父目录；未明确选择的查询失焦恢复当前名称，请求原文保留。06并非修复失败：看板过滤选项来自已有Mission记录，此项目最初没有Mission，故只有创建字段包含它；保留该生产合同，未扩张为全项目空筛选。

实际UI保存唯一手动草稿，public GET /mission HTTP200：Mission 86ad149ea7d1af98、Session ses_-zUQEUGDwzzyYWN7sziU、backlog，精确标题/原请求、Work、Base快照与真实stream-stop-755/project目录均一致。12显示侧边栏、筛选、卡片同为Project journey 773。持久Session kind=mission、project_id精确匹配，三旧Project name/worktree原值保留。读取检查器初次因Node SQLite行的null prototype（空原型）与普通对象deepStrictEqual比较失败，已改为逐字段精确比较并重跑通过；没有改数据或降低字段契约。

工具操作中的checkbox角色选择器无匹配：Kobalte ToggleGroup在DOM是pressed button，在原生AX呈checkbox；读取实际DOM后改为button操作成功。直接check视觉隐藏input未改变状态，点击可见Base/Dynamic标签成功且真实POST精确为Base，非模型或服务失败，不冒充产品根因。11/13保留真实重叠问题。

after原执行句柄12229已消费exit0、shutdown200、settle确认原native/launcher物理出生身份/输出/请求结清、配对副本退休；资格完整保留258695旧行、100项目/Git、229附件和源DB/认证目录，新增一个真实Mission Session及其正常bus/lease持久事实，总258766行，0模型请求/累计1260。无宽泛旧数据排除。final新阶段首额0与共同截止在prepare前落盘。

final main-rfyQogTc.js，14/16/17与19/21/23实际查看英语/中文：五条多行专家团说明均各占56px，列表仍240px，内容scrollHeight336px，行flex-shrink=0；实际滚动内层与外层后最后说明和安装入口均可达。原生Space选中Base，现有查询保留已选Dynamic并显示Outside this search，行高自然包含该标记；未安装市场包。切换编程类型后原请求、项目目录和候选排版正常。中文匿名后缀5fcedf与自定义Project journey 773查询、Esc/Enter和取消通过；名称与包内原文保持真实内容。15/22只是内层先滚动的中间状态，完整底部以16/23为准，未伪称全部图都显示全表。

final再次公共GET HTTP200及持久Session读取均确认唯一旧草稿仍backlog，精确原请求/标题/目录/项目ID/基础专家团快照一致。原执行句柄78779已消费exit0，shutdown200，settle确认原服务物理输出/请求/出生身份闭合，配对副本退休。final资格完整保留258766旧行，总258768行（仅本次两运行lease），源DB、100项目/Git、229附件及原认证/完整模型目录原值保留；schema9/92表、完整性和外键检查通过，三阶段0请求/累计1260，6配对副本已退休，共同截止未延长。

辅助验证：Node.js真实Vite构建after/final exit0、overlay typecheck exit0；最终i18n 2748键/2语言、CSS 9052引用/402源文件、docs 352 ops/26组通过。没有运行、新增或修改UI自动化。纯UI改动仅两个既有名称调用和本列表两条收缩样式；真实草稿保存是当前生产接口验收，不是新后端能力。手动实页和23图为UI验收依据，工具链结果只作辅助。

交付范围为上述三产品文件、07-panel、记录/三索引独占行与23图及人工/数据资格说明。开始时177项无关改动继续保留；提交使用独立临时index仅组装本轮内容并精确回写本轮条目，随后按当前upstream fresh fetch/普通merge与全待推集合复核、正常hook/push和fresh同步闭合。未创建分支、发布、标签或PR。持续Goal保持active，不受旧三Astra描述影响，仍单agent。
