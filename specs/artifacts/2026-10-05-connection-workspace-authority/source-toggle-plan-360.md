# 360 来源展开与收起动作说明

## Recall

用户要求持续自主改进Sources、UI/UX（User Interface/User Experience，用户界面/体验）和功能，最新人工要求只用单agent。上一轮359为progress：05aa218aa已正常推送，新标签页首次复制旧值在OpenCorvus来源/正文和独立MDN均复现，精确宿主/工具根因仍未知，未加产品绕行。本轮继续产品体验；整体goal active，旧Astra委托措辞无效。开始git仅有其他CI月记录改动，保持不动。

已读359 Recall、351来源末尾收起的调查与实施、07-panel来源合同、SourceParts、Disclosure primitive、两种locale及消息来源样式。全仓搜索chat.more_source/more_sources/collapse_sources与msg-sources__heading，调用仅共享SourceParts和两locale；主/Side/child均共用。相关路径检索未发现UI自动化测试；workspace-source-resolution为构建解析契约，不属于本次UI测试也不运行。当前SourceParts与359真实图12的版本相同。

## 现象、根因、影响与方案

359图12清楚显示第2–9条来源已经展开，但顶部动作仍写63 more sources；其真实点击动作是收起。SourceParts第468行只按数量选more_source(s)，没有读取expanded决定文案。原351增加了末尾Collapse sources并修复返回焦点与读点，未改变顶部标题，两处动作表达因此不一致。358名称/范围分层未涉及该逻辑。

顶部summary继续使用唯一cardExpanded事实和原生details/summary，按当前状态表达动作及其真实影响的来源数量：折叠时Show 1 more source/Show 63 more sources（展开其余…条来源），展开时Collapse 1 source/Collapse 63 sources（收起…条来源）。数量仍为实际group.length-1，第一条常显，无新增/删减/合并/重排。保留已有底部Collapse sources、焦点恢复、阅读暂停与来源身份；不增加状态、缓存、计时器、第二个summary或公共工具协议。

修改仅共享SourceParts的文案派生、中英文locale和07-panel合同。没有API/schema、Provider、配置、模型或调度变化；若出现执行/队列/恢复异常仍按Task/Mission/Session全入口横审。风险是翻译长度导致窄栏换行、单复数、切换后的按钮焦点与原底部返回，以及动态来源计数变化；以真实窄/宽页面和键盘操作核对，不以静态字符串断言代替。复制未知问题保留，不以本轮成功覆盖。

## 实施与验收

正式构建和类型/i18n结构检查后，fresh source-toggle-360-history /18355恢复356-live-02完整闭合90表历史，重新审核当前schema/config/recovery/Message/Memory/物理事实，保留原Project/Session。人工核对Main及Side大组英文/中文、顶部点击与Space/Enter、原底部收起返回；截图实际查看。不能直接用351/358旧图宣称本轮实现通过。

单复数用新真实gpt-6.1-sol流式会话source-toggle-360-live /18356补验。现有launcher配对复制auth entry与完整models.json，分别验证credential usable、catalog projected、actual model gpt-6.1-sol。预检通过后在该隔离Project创建两份各只有一个SOURCE360命中的普通Markdown文件，真实Web UI请求search_code并简短报告，保留原工具产生的两条来源，不合成消息或Source，不派遣成员。实际返回若不为两条须按原数据调查，不能改历史迁就界面。12请求预算，每个NativeService固定600000ms；不延长窗口，不启动独立Vite，不操作用户进程。

UI只真实交互/截图人工复核，不创建或运行UI自动化、DOM（Document Object Model，文档对象模型）/源码文案/组件/像素/剪贴板断言。实际checker只证明canonical Message/Source、工具输入输出/Provider流/HTTP交付和Native终态，不替代视觉。每scope先关自建页，再公共shutdown，join原handle至实际exit，核对Host/Native/端口/输出/request与复制凭据清除。保留失败和原始日志，扫描敏感值；更新根/月/目录索引及docs:check，范围提交、fresh fetch/merge、完整待推送集合审查与正常push。没有发布或版本升级，本轮不覆盖新大Research Studio历史/附件独立视觉/持续Rendering的全部长期目标。

## 实际实施与结算

共享SourceParts的toggleLabel只读取原expanded及实际group.length，两locale加入带数量的collapse单复数文案，原more文案增加Show/展开动词；原末尾按钮和状态不变。正式build15046 exit0，asset main-C-GbKPJC.js；类型76697 exit0，工作区locale2142键结构通过。

history页173完成Main/Side的英文折叠/展开、Space/Enter、中文窄栏与实际列表末尾收起返回，图03–12。01为加载，02目标未入视口，不计来源通过。原95647实际exit0，232516ms，先关页再完整公共shutdown97632 exit0、Native归档/独立闭合及精确Bun pile归档。

live页174由正常Web UI提交请求，真实search_code返回乙.md:2和甲.md:2两条Source。工具实际input为pattern/path/include，没有单独maxResults参数；原需求最多2条最终由实际两文件两命中满足，不把输入中不存在的参数写成已发送。英文单数及Space/Enter、保持展开切中文、末尾收起返回图14–18人工通过。13为刚提交的中间画面。原78524实际exit0，203967ms；5请求全部gpt-6.1-sol流式EOF，NativeService合格，复制auth/models已清除。全18图已实际查看，runtime checker只验证真实SQLite/input/output/Provider/HTTP/Native，没有UI断言。

构建中发现其他用户任务修改TitlebarBrand、ReleaseNotesPanel、changelog、titlebar.homepage locale键和根/月索引。保留全部；提交locale只选本轮Sources hunk，根/月只选360索引，其他文件不stage。相同构建包含这些独立工作区变更，视觉资格只绑定本轮来源区域。后续提交/同步前继续检查，不能把无关变更混入本轮提交。

当前已达成本轮来源动作文案与真实页面验收；359首次复制未知问题未修复，新持续Rendering/原大历史/附件/child独立视觉未取得本轮资格，原长期goal保持active。
