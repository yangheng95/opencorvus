# 设置目录的组合词发现

## Recall

用户要求持续按批并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查完成度和缺陷，先分析并落盘，再以真实桌面 /ui、截图人工复核、聚焦正向功能测试验收，范围提交、合并上游和正常推送后自主继续，直到明确停止。上批 55ff3160e 已推送，当前 main 与 upstream 0/0、暂存空；原 177 条工作区更改须逐项保留。Sol 凭据授权问题仍待回答，本批不需要模型，不读取、复制或使用凭据，不产生产品消息。

已读 ConfigDialogHost 的设置查询、分组、Tabs（选项卡）和页面生命周期，CONFIG_SECTIONS/configSectionSearchText、CommandPalette、text-search 服务及纯数据测试、NetworkPanel 代理草稿输入与重置来源，当前 07-panel 搜索合同、10 月 31 日 settings-control-discovery、11 月 1 日 multi-term-metadata-search 和既有设置输入保持决策。全仓同语义检索确认 CommandPalette、模型选择器和 Provider 元数据已用 matchesSearchTerms；正文、日志、表格与 Work Ledger 的完整子串匹配另有合同，不作全局替换。

functional_audit 与 ui_audit 两个既有代理并行只读复核，无再次委托、无文件或浏览器操作。二者均支持只在设置侧栏复用既有组合词匹配器；须保留 active pin（当前页导航保留）、规范分组对象、明确激活和原表单 owner（生命周期所有者）。代理指出 Network 草稿仅可在代理 URL（Uniform Resource Locator，资源地址）编辑，保持开关关闭、凭据空白，禁止 Save/Test/连接；查询时验证，最后恢复原值再离开。

## 修改前根因与影响分析

可观察候选：英文单词 language 能发现 Appearance，但 language appearance 或 LANGUAGE THEME 不连续出现在同一目录串中，当前侧栏要求整个 query 连续出现，可能显示无匹配；中文反序“语言 主题”同理。“主题 语言”在旧串本已相邻，不能作为前态失败证据。尚需真实页面确认，不凭源码直接宣称复现。

直接触发与控制流：ConfigDialogHost 从 config store 取唯一查询，trim/lowercase 后对每个 configSectionSearchText(..., t) 使用 includes(wholeQuery)。同一页面目录在 CommandPalette 已通过 matchesSearchTerms 对同候选逐词 AND（全部查询词满足）发现。共享匹配器按 Unicode 空白切词，字面子串、不模糊排序；每词须来自同一候选。目录 id、现有别名、当前语言页面与控件标签仍是唯一搜索事实源。

历史原因：10 月 31 日仅扩充真实控件标签进入单一目录；11 月 1 日组合词交付明确涉及命令、模型和 Provider，没有承诺 Settings 侧栏。本批是将已有元数据能力补齐到另一入口，不能称为该旧交付的设置组合词回归。既有当前页保留/草稿生命周期已单独修复，须据实验证，不能为新结果自动跳页。

范围：若实页成立，仅 ConfigDialogHost 导入 normalizeSearchText/matchesSearchTerms，保留空查询直接返回 CONFIG_TABS，逐页面调用 matchesSearchTerms(query, [configSectionSearchText(tab, t)])。不改注册表、翻译键、原排序、分组/tab 对象、active 并集、无匹配计数、标题/Tabs value/挂载面板和 SearchField 清除/Escape。不得把所有页面串合成一个候选，不新增别名字典、索引、影子查询或第二匹配实现。当前语言 t() 依赖继续自然更新。

无 API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、数据库/持久格式、授权、模型提示或调度改变。尚无 Task/Mission/Session（任务/多步任务/会话）队列、唤醒、恢复、并发或终态异常事实；若实页暴露该类事实，另按共享机制完整审计，不能以此局部筛选结论排除。内容全文搜索、多语言同时索引、模糊评分与控件自动定位不属于本批合同。

## 条件方案与验收

隔离根使用系统临时目录 opencorvus-iteration-20261108-b13，新 project 与 profile-before/after；before 开发 serve /ui 38944，最终普通构建后 after 38945。不绑定认证或模型目录，不操作用户窗口/进程。先英文 General 页分别输入单词及组合词，再经顶部 View/Language 原地中文对照，保存实际截图和只读观察。若没有真实失败则据实否证，不做猜测性产品修复。

实页证据成立后先补记录，再最小接入既有服务并更新当前架构。纯 UI 消费者改动不新增/运行 UI 自动化；text-search.test.ts 已读，均为候选 id/明确数据输出的正向合同，可聚焦运行，无需镜像 UI 测试。另跑 overlay typecheck、i18n、正常 build/renderer surface、docs:check 和 architecture-index；构建不能代替视觉验收。

最终桌面实页：英文 language appearance、大小写/空白/反序组合，中文“语言 主题”“Git 通知”“代理 网络”，观察正确页面发现与当前页 pin 的区别。仅明确 Enter/点击才导航；清空恢复完整目录。Network 仅输入本人非敏感 http://127.0.0.1:17996/b13-draft-only 于代理 URL，保持关闭开关与空凭据；查询、无匹配、Clear、非空 Escape 时原正文/输入仍保持，最后恢复原 URL 再离页。跨页面词组合须按实际页面候选返回空状态，而当前页继续可用。截图逐张人工查看，不写 UI 测试。

结束前正常关闭本人页面、POST /shutdown 并核原启动句柄 exit 0；更新本记录、artifact README 与三索引；精确提交本批文件且三 README 只暂存新增入口，保持原 177 条工作区事实。fetch/merge upstream、审查完整待推集合及必要验证后普通 push，然后继续下一批。未实测分支须明确保留，不把静态检查或模型自述冒充证据。

## 前态证据与最终实施决定

38944/main-CwbrNz6g.js、1280×720 桌面真实页面已确认：General 活动时 language 正确出现 Appearance（01）；改为 language appearance 后真实空状态、仅 General pin 保留（02/before-english.json）。顶部 View/Language 原地切中文，单词“语言”出现外观，再改“语言 主题”后真实中文空状态、仅通用 pin（03/before-chinese.json）。均保持原 General 正文与搜索焦点。首次通用 input[type=search] 观察命中隐藏背景输入，已当场更正为实际 #configSidebar input 并保存当前真实查询，不以错误选择器值作结论。

两个语言真实失败与已读控制流一致：同页 metadata 足够，完整连续子串语义导致组合词发现缺失；语言投影、当前页保持和现有条目本身工作正常。决定按上述最小方案实施，不增加译文/别名/状态，也不修改共享匹配器。before 本人 IAB 29 已关闭；服务正常 shutdown，原启动句柄 51584 exit 0。

已完成聚焦 text-search 纯数据正向 9 测试/10 断言、overlay typecheck、2 语言 2914 键、docs:check 352 操作/26 组与 architecture-index 20 文档。共享匹配器未改，没有新增镜像测试或 UI 自动化。最终 build/真实桌面验收尚待完成，不据这些检查宣称网页已通过。

## 最终实现与真实桌面验收

产品差异只有 ConfigDialogHost 的一个现有服务导入、归一化调用和每页匹配调用；07-panel 同步当前合同。共享算法、目录、语言键、API、持久化与其它搜索消费者都保持原实现。代理已独立只读复核最终 diff，active 并集、分组对象与面板生命周期保持。

普通 build 1 分钟及 renderer public surface 通过，新的隔离 profile-after/38945/main-C3zpoJNv.js、1280×720 桌面实页验收完成：

- language appearance 正确出现 Appearance，General 仍选中/正文不变且搜索保留焦点（04）。`  LANGUAGE\u00a0\tTHEME  ` 实际不可断空格与 Tab 也匹配同页。原生 Tab 到 Clear，再 Tab 到 General，Down 到 Appearance 时焦点在 Appearance、选中仍 General；Return 后才显示 Appearance（05/after-observations）。
- notifications git 从 Appearance 发现 General；proxy network 从 General 发现 Network，原活动页各保留一次，明确 Enter 后才换页。匹配来自同一页元数据、规范顺序不变。
- Network 代理 URL 原值为空，开关均关闭、密码均空；输入本人非敏感 b13-draft-only 后，language appearance 筛选只显示 Appearance 和当前 Network，正文/草稿实际保持（06）。language proxy 跨两个页面，真实无匹配状态、仅 Network pin 保留；原代理草稿仍可继续编辑（07）。
- Clear 后 18 个原导航恢复，焦点回原搜索框，Network/草稿保持。输入 b13-no-settings-results，再原生 Escape，查询清空、18 导航恢复、设置未关闭，焦点仍原搜索，草稿仍同值（08）。
- 保持该 Network 实例，通过顶栏原地切中文，查询“语言 主题”正确发现外观且网络仍为活动 pin，原代理草稿仍保持（09）。恢复代理 URL 的原空值后才 Enter 外观，中文主题/语言正文及当前查询一致（10）。再“Git 通知”发现通用、“代理 网络”发现网络，明确 Enter 导航后，最终网络标题/标签中文、代理为空、开关关闭/密码空、有效服务地址仍本人 localhost:38945（11）。全程没有 Save/Test、连接切换、凭据输入或模型请求。

前态 01–03、最终 04–11 共 11 张截图逐张人工查看。after-observations.json 保存步骤、实际 query、显示导航/选中、标题和必要草稿值，只是只读观察，不是 DOM 断言或 UI 测试。首次 Network 宽泛 input[type=url] 读到了上方 Server URL，已即刻用真实 Proxy URL label 重读并修正观察，再落盘；草稿保持以实际代理输入和截图为证。

本批未独立实页覆盖：全部 18 个目录逐一组合、多词跨活动语言时的任意词典组合、所有其它设置表单、原生 Tauri 窗口；未承诺切离面板后的草稿保持、模糊搜索或全文控件定位。既有共享纯数据正向 9/10、typecheck/i18n/build/docs/architecture 已通过，不以它们替代上述实页证据。Sol 授权仍待回答，本批无模型需要。

本人 IAB 29/30 已关闭，38944/38945 正常 shutdown，原启动句柄 51584/59509 均 exit 0，没有锁/helper/待下载文件。最终只暂存本批产品、架构、记录、必要截图/观察与三索引新增入口；提交、合并上游、检查完整待推集合、正常钩子推送后继续。
