# 命令、模型与 Provider 多词查找

## Recall

用户要求恢复持续迭代，只使用当前单agent，自主排查UI/UX（User Interface/User Experience，用户界面/体验）与功能，真实体验后提交推送，不操作正在使用的窗口。853已推送a010926db，Ctrl+K目标入口、17张实图、9原目标/2自然消息和全部数据保全通过；Goal保持active，旧三个Astra委托措辞被最新单agent要求覆盖。本批不委托，不操作18571用户服务/页面、用户数据库或其他窗口。

开始检查git status，176项其他状态保留。已读853 Recall/实际失败查询、text-search的唯一normalizeSearchText/matchesSearchParts、CommandPalette本地命令/Work Ledger读取和rowMatches、ComposerModelSelector.filteredGroups、ProvidersPanel.providerMatchesSearch、07-panel当前搜索与模型标签合同、纯text-search.test。全仓matchesSearchParts消费者还包括artifact-table和日志；composer-mention有独立语法匹配，不属于普通元数据筛选，conversation-search只共用归一化并保留原文片段/位置。当前版本所有这些差异必须按实际查询角色处理，不能直接改一个通用函数让内容搜索悄悄变成分词。

## 修改前问题与影响分析

853实页的settings general返回空，general则正常显示设置/通用。直接触发为本地命令把label、hint及keywords拼成一段，再要求整段查询连续出现；同样，“goal budget”中的两个已有检索词之间存在其他说明文字。模型选择器对id/label/providerID/providerName分别做完整子串检查，Provider列表对显示名、id和模型目录相同处理；因此来源身份和模型名分别命中也不能组合查找。当前三个入口均需在本批真实页面确认具体查询，再作产品修改。普通单词过滤正确，不是目录或认证缺失。

控制流根因是元数据发现被绑定到逐字段完整子串原语；目前缺少“每个检索词分别在该候选的真实字段中匹配”的能力。旧合同确实是完整子串，不能把符合旧合同的结果包装成后端故障。本批作为明确的体验能力演进：命令、模型选择器和Provider发现统一使用多词AND（所有词都匹配）筛选；顺序和空白不影响词的组合，字符仍按字面处理，不引入模糊排序、特殊查询语法、别名补丁或索引。

方案是在现text-search模块新增唯一matchesSearchTerms，复用现归一化，按空白拆分用户词，在候选原字段中逐词查找；三个已证实重复的元数据入口消费同一函数。CommandPalette工作行的rowMatches、公开Work Ledger查询和cursor（游标）、正文/来源定位、日志、表格内容过滤继续现有完整子串原语，其语义不同，不是兼容旧发现实现。无API（Application Programming Interface，应用程序编程接口）/SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、模型目录写入、LLM（Large Language Model，大语言模型）/流式协议或调度变化。不新增持久查询状态或平行配置。

风险包括不同候选字段被错误合并、过滤后真实模型ID/Provider身份改变、英文/中文和Unicode空白、特殊字符被当模式、空查询遗漏全部候选，以及影响其他内容检索。聚焦纯函数正向测试用候选数组到明确ID集合验证跨字段、逆序、重复空白、中文、特殊字符和空查询；原字面函数的三个正向测试保留。组件/DOM（Document Object Model，文档对象模型）/文案/快照/Playwright等UI自动化不新增、不运行，当前检索的测试路径仅纯数据测试，命名相近文件不作UI验收。

## 实施前真实验证方案

从已退休853-after完整QA（Quality Assurance，质量保证）数据建立metadata-search-854-before/38500，新60分钟绝对deadline只属于854，候选沿用不延长，启动余10分钟、物理结清余5分钟。当前schema9/92表、234309原行、140附件、62项目文件/Git保留；配对投影已授权认证与完整models目录，分别验证Provider与精确gpt-6.1-sol，新增模型请求上限0，累计1180保持，不发送消息/Goal或创建Task。

冻结main-BTGhDWow.js，经正式开发serve的/ui及后台自有页确认settings general、goal budget，以及实际目录中的提供方/模型组合查询；截图人工复核结果。随后补充实证、范围保护并实施，类型/普通build/原聚焦单元runner验证后，另启38501新发生轮次。实际正序/逆序命令选择打开原设置或目标表单，模型跨字段查询展示真实标签/全ID并选择既有同一个Sol模型，Provider筛选保持同一个真实卡片；中文实际操作。不得以纯匹配器分数、DOM文字或构建通过替代实页/截图。

结束自有页和服务，公开shutdown、原exec/native/launcher与物理/输出/请求/出生身份结清后退休配对副本；原9Goal、全部业务列/附件/文件/Git和源库保全。同步三索引及当前docs检查，范围提交，fresh fetch/普通merge后核对完整待推集合，正常hook push与远端回读。其他工作区改动只在真实冲突时处理，不因独立并行文档暂停。

## 本批实证与实施确认

38500/main-BTGhDWow.js自有69页。01稳定显示settings general无匹配；02是goal budget请求仍在加载的中间画面，不作为稳定空结果证明，随后重新查询取得稳定零项并补06。模型选择器实际有OpenAI/openai十二个真实标签与完全限定ID，03输入openai sol却显示No matching models；Provider页实际OpenAI/openai/12 models/Connected，04组合openai connected无结果，05单词openai正确显示同一已连接卡片。这三处共同确认元数据组合查找缺口，未发现目录、模型投影或凭据错误。

已核对Provider两类行：配置行含现有modelIds与可见摘要，内置目录行只含原id/name/模型数/连接状态。新匹配器只消费各自已有字段，不为内置行另取模型目录或增加后台读取。模型/Provider搜索提示同步当前两语言，说明可按模型或提供方名称/关键词查找；不把内置Provider支持任意模型ID查找写成已交付能力。当前Task/Mission/Session调度不受影响且未发现异常，不借本批筛选改动推进执行机制。实施范围为一个纯匹配模块、三个原调用点、纯数据测试、两语言原提示及07-panel；修改前八个tracked路径原差异为空并已保护。

## 实现与实际验收

matchesSearchTerms复用唯一文本归一化，对同一候选的原字段逐词作字面包含，空输入保留全部候选。三个元数据入口均移除原完整查询匹配，命令的label/hint/keywords直接传原字段数组；内容型matchesSearchParts及其实际调用点保持。没有模糊排序、查询别名特例、后台模型调用或新索引。原两个搜索提示已接两语言。首次补丁对中文旧提示的假定与原文不同，工具原子拒绝且工作差异为空；读取真实文案后完整应用，没有部分替换遗留。

正式纯单元runner仅运行text-search.test.ts，原三项字面匹配与六项多词正向契约共9项/10断言全部通过：同候选跨字段、逆序/大小写/Unicode空白、原顺序、提供方和模型家族、中文/百分号/下划线/括号/路径字符、空查询。类型、2675键/两语言、普通build/renderer公共面通过，最终main-B5pEdU0R.js。未运行UI自动化测试。

38501自有70页，07实际settings general显示设置/通用两原命令；逆序加大小写/多空格的GENERAL settings同样正确，08实际选择General进入原设置。09 budget goal命中原Open goal，Enter的10打开唯一目标表单并保留META854_DRAFT_KEEP及Objective焦点；未启动，最后清空草稿。11 openai sol实际返回原gpt-5.6-sol/gpt-6-sol/gpt-6.1-sol三项，12 Sol openai 6.1精确到同一原Sol；13真实点击后当前输入菜单完整ID仍openai/gpt-6.1-sol，标签GPT-6.1 Sol。没有发送模型消息或修改旧Session模型。

14—15通过settings providers打开Provider页，openai connected及CONNECTED OpenAI均显示原OpenAI/openai/12 models/Connected，过滤1/227。切换隔离页中文后，16—17“打开 目标”打开同一中文原表单，18 OPENAI sol显示三原模型并保持选中同一Sol；19点击清除恢复十二原模型。20“已连接 openai”保留同一Provider，21清除恢复目录，中文提示完整显示。含账户信息浮层的中间原图仅保私有，公开18为移开指针后重新实拍，无图像编辑。全部21张公开原图均实际呈现并亲自查看；02仍标记加载中间图，不改写为稳定失败。

before/after两轮原schema9、92表234309行的全部业务列保持，未新增业务行；九个原Goal公开完整事实逐字段一致，140原附件、62原项目文件/Git与源库保持，无项目排除。选择模型和中文仅使用本轮隔离页面自己的设置生命周期。模型新增请求0/累计1180；四份配对auth/models副本退休，源认证元数据及模型目录字节/元数据保持。两个原句柄76053/51807与native/launcher均0，公开shutdown200，物理/输出/请求及出生身份结清，余3406943/2892555ms，原854期限未变。自有69/70页关闭、受控库存为空，没有操作用户窗口、18571服务或用户数据库。

本批没有实页重跑正文/来源定位、日志、表格或Work Ledger多词查询；这些内容型检索合同保持，不能将元数据组合搜索截图说成它们也按多词匹配。没有新增模型、Provider配置或真实Goal执行；内置Provider仍仅筛选原可见字段。原图及数据汇总见[验收目录](../../artifacts/2026-11-01-multi-term-metadata-search/README.md)。提交、上游同步、完整待推审查、正常hook推送及远端回读完成后继续下一批，Goal保持active。
