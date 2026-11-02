# Mission 受阻事项的直接阅读（891）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，真实页面验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra文字。890已推送37a9b5af6f4d797275e1b43d5180d16d8bdc1bc7，fresh HEAD=origin/main、0/0，29本轮普通文件/18本地化字段/三索引行提交，177项无关改动保留；源890-after严格资格259047行/schema9/92表、100项目/229附件。原服务句柄15996消费exit0、关闭HTTP200、物理输出请求闭合及配对副本退休，累计1260模型请求。前轮为有真实截图和权威提交的progress，不是等待。

890实页的受阻Mission 0249bbe6c48d8cce、Session ses_-zUQiNDP0zzyyPiL2nvx、live-mission-blocked-741/project真实有1成功/1失败Task及outcome.kind=blocked。原summary先描述第一项已交付，卡片两行截取没有显示后面的客户原件缺口；公开outcome.unresolvedCriteria已有一条完整事项，UI没有任何消费者。此真实字段能解释未满足条件，不能靠标题、失败状态或关键词猜原因。

已读：AGENTS、890 Recall/资格/fresh推送与原始截图复核；MissionBoard全部卡片/搜索/项目/操作、其样式；mission/completion.ts的blocked联合类型及1–32项原文合同；board.ts读取原始工具输入/回执且校验相等后投影unresolvedCriteria的路径；MissionRecord与SDK（Software Development Kit，软件开发工具包）类型；WorkOutcomeBadge的现状态映射及App/WorkLedger全部调用、07-panel Current Surface Ownership；原生Disclosure primitive（基础组件）、其键盘/展开和样式合同、Feedback及卡片其他操作区。全仓unresolvedCriteria/outcome.summary/mission.outcome.blocked搜索已覆盖：后端已有完整投影；看板只消费summary，标题/侧栏用既有受阻状态，不新增业务状态。相关路径未发现仓库UI自动化测试，不新增或运行它们。

## 修改前深度与影响分析

- 可观察现象是看板只有截断的混合结果总结，未满足事项只能到会话查找。触发点是渲染带blocked outcome的MissionRecord。数据流已包含真实unresolvedCriteria，直接根因是当前卡片没有读取该字段；原890仅修Task进度，未把Mission受阻事实与待满足事项接入卡片。不得改变summary原文、用关键词截取或推断下一步操作。
- 在当前MissionBoardCard添加一个默认折叠的原生Disclosure，完整展示当前blocked outcome.unresolvedCriteria，保留原文顺序、换行及所有字符；用当前语言的受阻标签和事项数量明确入口。使用现Disclosure及设计token（设计变量），保留原任务Badge，不新增弹窗、窗口、原生全屏、导航或请求。原因展开区是卡片打开按钮的兄弟节点，避免把交互控件嵌套进按钮；主卡片仍打开原Mission。
- 所有数据仍读取当前props.mission.outcome；只做类型收窄，不缓存业务事实、另造状态、添加fallback（后备路径）或要求模型重写原因。Disclosure使用浏览器原生展开状态，普通同卡片刷新读当前事实；筛选/导航导致卸载后不承诺保留展开。blocked消失时其阅读区随当前事实退休。 accepted和未有结论的Mission不出现该阅读区，原验收与调度规则保持。
- 受阻状态文案复用mission.outcome.blocked，沿标题/侧栏现事实语义。新增的“未满足事项”标题与完整无障碍名称接入两语言及本地化数量；作者/模型原文和真实文件身份不翻译。详细列表完整换行，折叠时保持桌面卡片密度，当前列的原滚动负责长内容。
- 公开API（Application Programming Interface，应用程序接口）、SDK生成、数据库schema（结构）/迁移、Provider、Task/Mission/Session occurrence（执行轮次）、调度/唤醒/恢复/终态及配置均不改；没有调度异常证据，不把受阻结果当调度故障。若实跑出现共享机制异常，必须立即横审全部生产路径。本轮纯UI没有非UI替代实现要单元测试。
- 风险：摘要与状态的阅读优先级、原生summary的Enter/Space操作、点击展开误触主卡片、窄列长文件名换行、列内滚动、刷新时展开状态及语言切换。必须真实点击、键盘和截图复核，不能用DOM（Document Object Model，文档对象模型）断言、组件渲染或构建成绩代替。现源有一条长事项；多事项/极限32项是否有真实实例未知，不造消息/夹具或改原状态凑例。

## 首次资源与验收顺序

首次prepare前声明before/after模型额度各0、75分钟共同绝对截止和5分钟闭合预留，不加额、不续期、不重启。本人隔离开发CLI（Command Line Interface，命令行接口）38608/38609的/ui/；before复用890合格main-Y2tOqPNR.js，after由Node.js构建，不启动独立Vite。凭据/完整模型目录成对验证复制及退休，不输出秘密。全部旧行、100项目文件/Git、229附件保全；用户18571窗口和真实数据库不操作。

1. before公开读取同一Mission/blocked/完整未满足事项，真实看板与原会话状态中英文截图；原始磁盘图也人工查看，区分工具内联显示差异与产品事实。正常关闭HTTP200、原句柄exit0、物理身份/输出/请求闭合、配对副本退休及全数据资格后修改。
2. 实施当前卡片的原生阅读区、样式、两语言和07-panel合同；Node构建、overlay类型、本地化/CSS（Cascading Style Sheets，层叠样式表）/docs聚焦检查。
3. after同一受阻Mission默认入口、点击展开/折叠、Enter/Space、完整原文与长路径、原列滚动、刷新后当前事实、中英文标签、accepted/草稿对照及主卡片打开原会话。视觉原图逐张查看。未知样本如实标记，不宣称全浏览器或辅助软件语音验收。
4. 本人服务关闭、原句柄消费、配对副本退休、全旧数据资格、三索引；仅本轮提交、fresh fetch/普通merge/完整待推集合审查、正常hook/push及fresh 0/0。890私有字段写入器已修复为使用原JSON属性顺序；沿该工具完成本轮隔离索引保护，不绕过检查。Goal保持active。

## before真实确认

38608的01/02中英文原卡片只显示总结开头，未满足条件没有阅读入口；03主卡片打开原Session后标题受阻状态正确，原交付物/消息仍完整解释customer-signoff.md缺失。直接重读磁盘01/03原图与页面事实相符，不以工具内联差异判定产品缺图。公开清单HTTP200保留同一13条Mission，目标为真实blocked及一条完整未满足事项；它不是待输入或仍在重试的任务，不新增催问或执行操作。

before公共关闭HTTP200，原句柄34481消费exit0、原native/launcher物理身份/输出/请求闭合，认证和模型目录两文件退休。严格保全259047旧行、100项目文件/Git、229附件和源DB，当前259049行仅新增两条本运行租约，schema9/92表。模型请求0/累计1260，原截止保持。按落盘方案只接入现公开字段与原生阅读区。

## after实页与交付范围

main-CIjqGyl0.js在38609完成04–13真实交互和截图人工复核：默认入口清楚显示受阻/未满足数量；点击展开原文时仍停留看板，完整customer-signoff.md事项及末句可读，长文件名自然换行。Enter折叠且焦点可见，Space重新展开；真实刷新后同一卡片仍展开并读取当前数据。Completed列独立滚动不改变当前受阻区。中文切换后入口、完整无障碍名称与数量均更新，原文保持且当前展开未丢失；点击折叠、搜索筛选后重新展开正常。主卡片仍打开原Session ses_-zUQiNDP0zzyyPiL2nvx/同一项目及原受阻历史，返回看板正常。

原生AX（Accessibility，辅助功能）暴露summary的完整标签、展开状态及正文；DOM角色定位曾对button返回no_matches，而原生AX点击和原生Enter/Space均实际通过。只记录两种工具定位的差异，不从它推断产品辅助功能缺陷，也不强加新的role或包装层。只读DOM原文/summary标签、open属性和父节点观察见artifact文件，无UI断言；实际截图和操作独立验收。直接重读磁盘01/03/05/13原图与界面相符。全部13张截图实际查看。

before/after真实公开Mission HTTP200，13条完整记录deepEqual（深度相等），同一blocked outcome及原unresolvedCriteria保持。两阶段259047→259049→259051行，仅各新增两条当前运行租约；schema9/92表、所有旧业务行、源DB、100项目文件/Git、229附件和原认证/模型目录元数据严格保全。原句柄34481/71863全部消费exit0，公共关闭HTTP200、原native/launcher身份、物理输出/请求清理闭合，配对副本各两文件退休。模型请求各0/累计1260；共同截止未修改，after闭合余3560874ms。

Node.js构建、overlay类型检查、本地化两语言2753键、样式9065引用/402源文件及docs:check（352操作/26组）均exit0。无UI自动化测试。真实样本仅一条长事项，多事项/32项极限、Firefox与辅助软件语音未实跑，不宣称这些覆盖。草稿、accepted卡片和原会话状态在实页对照，未改验收或执行协议。交付仅当前卡片原生阅读区、样式、两语言、架构及证据；用户18571窗口和真实数据库未操作。Goal继续active，后续转向其他页面的理解成本与功能排查。
