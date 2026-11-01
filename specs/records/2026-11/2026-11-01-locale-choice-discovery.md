# 语言选项与命令发现

## Recall

用户要求单agent持续自主排查UI/UX（User Interface/User Experience，用户界面/体验）和功能，实际体验后提交推送，不操作正在使用的窗口。旧长期Goal的三个Astra措辞已被后续要求覆盖，本批不委托。856已推送62c19ca68，真实发现并修复Goal切换读取就绪，23张图含首候选失败、最终复验/原9Goal保全、正常hook及远端0/0已验证；继续下一批，不重复旧Rendering或全屏问题。

开始完整git status与前批结束完全一致，176项无关状态保留，HEAD=upstream62c19ca68。已读856 Recall及交付、854多词元数据筛选、当前07-panel设置/命令发现合同、CommandPalette本地LOCALES和命令字段、AppearancePanel本地选项、i18n的SUPPORTED_LOCALES/类型/加载/归一化、locale-preference唯一串行保存、TitlebarMenubar两个切换调用和纯locale-runtime-selection测试。全仓搜索语言列表、翻译键、固定原文及导出消费者，当前选项枚举只有上述三处；Titlebar的两语切换仍调用同一保存面，不是独立选项目录。未发现调度/恢复/队列异常，不扩为执行机制审计。

## 修改前分析和未知

856过程中英文命令面板查询Chinese未直接找到语言命令，改用language才能选原中文选项；当时0项还带Loading，不能作为稳定空结果证明。本批先实页重新确认。源码确定命令标签只有硬编码English (US)/中文 (简体)，而设置页取当前语言翻译（English/Chinese (Simplified)），支持语言ID（Identifier，标识符）又由i18n另列；中文设置页的English也保持固定英文。直接触发是用户用界面所显示的语言名称查询切换命令，原本地元数据不含该名称。旧854多词匹配正确，但不能匹配不存在的本地化字段。

根因为同一语言选项有分离的目录与显示文本来源。方案为在现i18n模块登记唯一支持语言描述（原en-US/zh-CN、原翻译键、语言自称），从它推导支持ID及类型；提供同步的当前语言选项函数，使用现t，外语选项同时显示本地化名称和语言自称，相同文本不重复。命令和设置下拉都消费同一选项；删除两份内联列表及已失真的旧theme说明注释，不留并行选项目录。命令沿现matchesSearchTerms过滤真实标签与原locale/language/ID元数据，不添加Chinese/中文等查询特例或任意别名。

英语现en-US标识在英文显示English (US)，中文显示英语（美国），保持真实区域；外语自称有助于误切语言后的识别。原保存/回退/串行化、运行环境默认语言规则、资源请求路径、当前语言状态及两个Titlebar切换动作不改。两个ID仍完全相同；目录装载从同一描述推导，不依赖另一语言资源先加载才能显示自称。不新增库、API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、设置键、消息或LLM（Large Language Model，大语言模型）调用。

影响面为i18n支持目录/类型、命令标签/查询、设置显示、两语言原键和当前架构。风险是支持集合/类型或默认语种变化、语言切换后命令缓存旧标签、两处写入不同ID、已选设置值丢失、双语标签过长，以及把词义相近但未声明的词当成支持查询。核心归一化的现纯正向测试保留并增加明确canonical/region输入及UnsupportedLocaleError错误类型契约；不测试UI文案、DOM（Document Object Model，文档对象模型）、组件、快照或截图差异。UI仅真实页面人工复核。

## 实施前真实验收方案

从已退休856-after2完整QA（Quality Assurance，质量保证）库建立locale-choice-857-before/38507，原schema9/92表234499行、140附件、62项目受保护业务文件/Git和9Goal保存。项目文件快照不含.opencorvus运行元数据，.git核对HEAD/ref/index/status，不夸大为全部元数据字节覆盖。新60分钟绝对期限属于857，候选沿用不延长，启动余10分钟、物理结清余5分钟。配对复制已授权OpenAI认证和完整models目录，分别核验Provider注册和精确gpt-6.1-sol投影；新增模型请求上限0/累计1180。

使用正式开发serve的/ui和自有后台页，用户18571服务/页面、窗口及用户数据库不碰。基线英文实际Chinese查询稳定结果、设置原语言选项，以及中文按英语查询；补充实证后才改产品。候选38508冻结新普通构建，实际Chinese/中文/原ID/组合关键词过滤和选择切换，中英文设置下拉与命令显示一致，英文恢复路径和新页持久语言核对。查询不承诺未声明的跨语言同义词。通过截图人工复核双语标签、弹层宽度/焦点、原首页草稿保留，最后清空本页草稿，不发送消息或Goal。

类型、当前check:i18n、普通build/renderer公共面和聚焦纯运行语言测试辅助；不新增/运行UI自动化。结束全部自有页、公开shutdown及原exec/native/launcher、物理/输出/请求/出生身份结清，退休配对副本；逐表全列、原附件/文件/Git及原9Goal公开事实验证。同步三索引，运行当前docs:check，范围提交，fresh fetch/普通merge及全待推审查后正常hook push/远端回读，独立工作不等待，只有真实冲突处理。

## 修改前真实确认

38507/main-mPTc0h-C.js自有76页，01 English界面Chinese查询完成后的稳定空状态；02正式设置语言下拉真实列出Chinese (Simplified)，证明命令元数据与用户所见名称脱节。真实选中中文后03“英语”查询同样稳定为空。没有将Loading中间状态作为结果，也没有Provider/网络模拟。七个生产/纯测试/架构路径原差异为空并保存。

实施细化：唯一目录的语言自称取English (US)/简体中文，原翻译键给出当前语言名称；标签在名称与自称不同才拼接双语显示，两入口使用完全相同标签。Command附原规范ID作hint，保留locale/language/ID真实检索字段。原SUPPORTED_LOCALES从目录推导，类型仍仅两原ID，UI仍English在前。两个Titlebar切换动作和串行保存实现不改，不增加词义别名。

## 实现与实际验收

唯一LOCALE_OPTIONS在现i18n中登记两个原ID、原翻译键与自称；SUPPORTED_LOCALES及SupportedLocale从它推导。同步localeOptions使用当前t，名字和自称不同才组合，设置/命令共用结果。删除两个内联列表与其旁失真的theme说明；命令hint显示原规范ID，原多词匹配器与locale/language/ID检索字段保留。没有新增语言、查询特例或别名。英文与中文en-US原键补全美国区域信息；当前zh-CN自称简体中文与中文原翻译一致。语言保存、默认政策、加载资源路径与Titlebar双语切换未改。

四项纯解析测试/四断言通过：原两项运行环境语言映射、明确canonical/region输入到原ID、de-DE到UnsupportedLocaleError。没有UI文案/DOM/组件/快照或浏览器自动化断言。类型、2676键/两语言、普通build及renderer公共面通过，最终main-DqgM6m1u.js。

38508自有77页，04 Chinese及05 language Chinese命中同一zh-CN本地动作；实际选择后06中文界面与LOCALE857_DRAFT_KEEP保留。07“英语”、08 English、09“英语 en-US”命中原en-US动作，真实选择后10恢复英文且草稿保持。11英文设置下拉与命令的Chinese (Simplified) · 简体中文完全一致，English (US)不重复；选中文后12“英语（美国） · English (US)”和简体中文完整显示，实际选英语后13设置恢复英文。14回主页原草稿仍在，15“中文 zh-CN”命中原中文动作并实际切换。清空验收草稿后另开78页，16初始完整界面已保持中文，证明原保存生命周期。

05/08/09截图时后台工作检索尚Loading，本地命令已真实可选，不用这些图证明工作检索已经完成；01/03基线空结果均等待完整稳定状态。16张原图全部实际呈现、亲自查看；两处语言标签/弹层宽度、焦点返回与原草稿均通过真实交互，未操作用户窗口。未重放原生Titlebar切换、系统区域设置、应用重启或新增语言，不承诺任意未声明的同义词。

两轮before/after原schema9/92表234499行所有列完全保持，无新增业务行；九个公开原Goal逐字段一致，140附件、62项目快照内业务文件/Git身份与源库保持，无项目排除。原.opencorvus运行元数据不在文件字节快照内，.git以HEAD/ref/index/status核对，不扩大覆盖结论。新增模型请求0/累计1180，四份配对副本退休，源认证元数据及模型目录字节/元数据保持。两原exec 69836/13902、native/launcher均0，公开shutdown200及物理/输出/请求/出生身份结清，余3320968/2643286ms，原857绝对期限未延长。自有76—78页关闭、受控库存为空；用户18571服务/窗口、用户数据库未操作。

同步索引与当前文档检查后按范围提交，fresh fetch/普通merge、完整待推审核、正常hook推送和远端回读；长期Goal保持active，继续单agent迭代。
