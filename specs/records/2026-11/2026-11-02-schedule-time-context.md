# 定时任务时间语境（887）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，实页验证后提交推送，不操作正在使用的窗口。旧Goal中的三Astra文字被后续单agent指令覆盖，不委托。886为实质进展：914b1e10964a75b596948c992fa22e13c4091c52已推送，fresh HEAD=origin/main、0/0，32本轮文件干净、三索引行同步，177项无关改动保留。源886-final2 schema9/92表、258862行、100项目/229附件；原句柄97421 exit0/public shutdown200/物理输出请求与出生身份闭合、配对副本退休，累计1260模型请求。

本轮体验定时创建、编辑及时间语义。已读代码发现：recurrenceSummary显示任务墙钟时间与IANA（Internet Assigned Numbers Authority，互联网号码分配机构）时区，但formatTimestamp用当前语言及浏览器时区格式化实际instant（时刻），输出没有注明时区；Next/Last/运行历史及列表共用它。用户设09:00 London时可能看到17:00而无法辨别显示时区。尚未获得本轮实页证据，不把推断当完成。原日期/时钟控件样式与语言由宿主参与，暂未知是否属于产品内容问题，本轮不擅自改日历控件或构造平行日历算法。

已读：根AGENTS；886 Recall/最终资格/fresh推送；07-panel定时作者稿、投影时间/时区/暂停、版本写入合同；ScheduledAutomationsPanel创建/编辑快照、项目身份、日历字段、时间格式化与列表/详情/历史全部调用；automation-recurrence现解析/序列化/更新比较、自动化服务客户端；生产automation-service create/update的不可变定义版本与fire frontier、automation.sql结构。定向测试scheduled-automations/automation-project-targets是纯服务和日历数据映射测试，不运行UI自动化。全仓formatter及当前时区语义搜索：当前Scheduled私有formatter唯一拥有这三类时间显示；已有browserTimeZone与其他业务时区不改。新本地化键尚未存在。

源DB只读确认五个当前自动化定义均paused，没有active定义；源Project 801已有精确身份prj_hY6kPfHVDg5lcTRFOYg9及旧文件/Git。任何新定义仅在本人副本创建。before与after都首次0模型请求，允许本次明确的UI元数据写入，不启动任务或按Run now。创建一个2026-12-04周五09:00 Europe/London的未来项目定义（晚于共同验收截止），先读取真实nextRun及实页，然后通过UI暂停；after编辑该同一暂停定义的名字，核对原日历、目录和暂停状态保留。生产update追加不可变revision，不覆盖源历史行，不直接SQL写入。

## 修改前根因、影响与方案

- 现象待实页：任务规则时区与实际时刻显示时区不同却无标注；直接触发为浏览器时区不等于任务规则时区。原formatTimestamp仅Intl.DateTimeFormat(localeTag(),{dateStyle:medium,timeStyle:short}).format(...)，浏览器时区作为隐含选项；recurrenceSummary属不同数据角色。旧本地化只翻译日期和规则名称，没有解释同一页面的两个时区语境。不能把8小时显示差异判定为调度错时，必须读取真实instant核对。
- 确认后在现私有formatter复用同一个Intl.DateTimeFormat实例，读取resolvedOptions().timeZone与该实例格式化的时刻，经现i18n（internationalization，国际化）面添加时间及明确时区的一条键，两语言覆盖；保留当前浏览器时区语义，不更改原instant、规则时区或服务端nextRun。Next/Last/历史与列表共享一个当前实现；空时刻Never及Paused既有语义保持。无额外状态、缓存、兜底时区、平行formatter或二次日历算法。
- 私有函数签名可保持，搜索全部调用与同语义实现后只改当前组件及两语言独占字段，07-panel同步。后台路由、SDK（Software Development Kit，软件开发工具包）、日历解析、数据库schema（结构）、版本化迁移、配置和数据格式不改。纯UI不添加/修改/运行任何UI自动化；源代码文案/DOM（Document Object Model，文档对象模型）/组件/快照/像素断言均禁止。
- before创建且暂停后，after只改此定义名称；新旧不变日历通过真实请求、GET及持久定义版本核对。不在客户端猜测实际nextRun。若真实nextRun不是该未来时刻，或出现调度/队列/恢复/并发/终态异常，立即按共享机制横审全部生产入口及Task/Mission/Session执行轮次、终态/重试/重启、串并行与多项目；不得归因单个用例或模型。没有此证据时不机械扩大后台审计，也不宣称调度矩阵已重新验证。
- 风险：明确时区增加时间字符串长度，列表/详情/历史需实际复核换行和密度；浏览器/任务时区相同与不同时都应可辨，双语言标点与日期格式跟随当前语言。高级规则原文和IANA标识保持真实内容，编辑不得重设开始日期或丢失暂停状态。浏览器原生日历显示若仍有混淆，继续调查但不伪称此次标注已重写原生控件。

## 首次资源与验收顺序

before/after首额各0，首次prepare前75分钟共同绝对截止与5分钟闭合预留，不续期、不加额、不重启旧阶段。成对验证/复制原认证及完整模型目录并在闭合后退休，凭据内容不进入日志/文档/Git。保护全部258862旧行、100项目文件/Git和229附件；原用户数据库不作写入目标。本人隔离开发CLI（Command Line Interface，命令行接口）/ui/端口38596/38597，before复用已合格main-DSE5KBTe.js，after用Node.js构建；不启动独立Vite，不碰用户18571或其他窗口。

1. before真实创建未来项目周任务，读取公开nextRun精确2026-12-04T09:00:00Z，截图对照规则09:00 London与浏览器本地显示、实际进入暂停；正常shutdown200/原句柄exit0、物理输出请求与出生身份结清/配对副本退休/全旧数据资格后再改产品。
2. 依据实页确认补上当前时间显示语境及双语言键；聚焦build/typecheck/i18n/CSS（Cascading Style Sheets，层叠样式表）/docs不代替视觉验收。
3. after中英文实页列表/详情标注、打开编辑保留日历/项目、仅重命名保存及暂停状态；如需展示active nextRun，未来边界不变且UI恢复后再次暂停。真实请求/GET及持久版本正向核对；源旧行/文件/Git/附件保全。
4. 正常闭合与配对副本退休、全数据资格，三索引同步；仅本轮提交，fresh fetch/普通merge、全待推集合审查、正常hook/push和fresh同步。Goal保持active。

## 实际证据

before01实际填写Project801、2026-12-04周五、09:00 Europe/London并保存；02详情与03列表真实显示17:00却未注明显示时区。04已通过UI暂停。真实POST/PATCH输入、GET HTTP200及持久active/paused两版本核对原项目ID prj_hY6kPfHVDg5lcTRFOYg9、日历、prompt、local workspace与nextRun=1796374800000（2026-12-04T09:00:00.000Z），是正确未来时刻，不能将显示差异当调度错误。暂停仍保留该frontier，UI显示Automatic runs paused。

CUA（Computer Use Agent，计算机使用代理）的只读evaluate环境未提供Intl，直接读取浏览器Intl的取证尝试失败；未以Node主机时区替代。初始表单由browserTimeZone()初始化并实页显示Asia/Shanghai；after将以产品同一formatter输出的明确时区作为实际呈现证据。该取证失败不影响原页面，也未重启服务。

before原句柄1986消费exit0、shutdown200、原native/launcher出生身份/物理输出/请求结清、配对副本退休。严格资格完整保留258862旧行、100项目/Git、229附件、源DB与原认证/模型目录元数据；总258869行，新增两个不可变自动化版本、两条版本项目成员、一份未来logical fire（逻辑触发事实）及两条本运行lease。模型请求0/累计1260，schema9/92表。历史显示This automation has not run yet，未执行Run now。

after05真实编辑同一定义并仅重命名，公开GET HTTP200和持久revision3核对项目、日历、prompt、local workspace及paused保持。06/07英文详情与列表明确显示Dec 4, 2026, 5:00 PM (Asia/Shanghai)，08/09中文显示2026年12月4日17:00（Asia/Shanghai），同时规则仍为周五09:00 Europe/London；1280×720实际截图中完整可读，无需改布局。为观察nextRun曾恢复该未来定义，实际GET/持久revision4及future fire仍精确为2026-12-04T09:00:00Z，随后10通过UI再次暂停，GET/持久revision5确认paused及原日历/目标保留。名称中的“已暂停”仅是本验收定义名称，真实状态以各截图badge和公开记录为准。没有触发模型执行。

after原句柄44604消费exit0、shutdown HTTP200，原native/launcher出生身份与物理输出/请求结清，另两份认证/模型目录副本退休；严格资格保全258869旧行、源DB、100项目文件/Git及229附件，总258878行。新增三个不可变定义版本、三条项目成员、恢复定义对应的未来logical fire及两条本运行lease，均为当前公开操作的持久事实；schema9/92表。before/after各0模型请求，累计仍1260，共同截止剩余3403000毫秒，不续期、不重启。闭合首次误用Windows PowerShell 5.1，私有观察器ArgumentList未提供导致调用失败；改为项目既有PowerShell 7运行原shutdown脚本后成功，未修改/重启产品，失败原工具输出保留。

Node.js构建main-ghCST1bP.js、overlay typecheck、2749键/两语言i18n、9052引用/402文件CSS token检查及文档检查均exit0；视觉证据是10张真实页面截图的人工复核，以上工具检查不能代替它。实际覆盖浏览器Asia/Shanghai与规则Europe/London的不同区场景；没有额外构造相同时区或已执行历史数据，Last run/运行历史复用相同formatter的代码范围已核对，但本轮不宣称这两类非空历史时间已实页验收。原生日期控件的宿主格式未改，后台调度/数据schema/迁移/公共接口未改。
