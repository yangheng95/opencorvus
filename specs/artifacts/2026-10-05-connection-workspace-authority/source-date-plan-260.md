# 260 来源日期可读呈现

## Recall

用户要求持续自主体验、改进UI/UX（User Interface/User Experience，用户界面/体验）与功能，重点Sources（来源）及侧栏渲染；最新明确单agent。只root，不委托、不创建成员/Task/分支/worktree。259是进展：26d50f6686bc43c87a65c6c29d3fec12c1cd8527已推送，起始工作区干净；真实Main长摘录/折叠及外部网页返回保持，新增原生预览范围未证明。持续原完整目标，不以单批通过声明完成。

259原07/09截图中Source Tooltip第三行直接显示2026-09-10T00:00:00.000Z与exa，机器序列化形式妨碍浏览。已重读259 Recall与当前SourceParts、tooltip CSS、全仓publishedAt/publishedDate定义/调用、Exa（搜索服务）解码/source投影、SourceUrlPayload、现locale/time工具、当前私有history copy/native/custody。日期源字段仍是optional非空string，并非保证机器timestamp；不能用宽松Date.parse把仅年份/月或作者文字补成不存在的日子。现time工具是执行时刻的本地日期时间，不能用它将来源的零点出版日期变为08:00，或令跨时区来源出版日变化。

## 深度、根因与范围

观察证据是原真实Source已完整保存其日期、title、url、provider，Tooltip却直接拼接原publishedAt，没有独立的阅读表达。这是UI信息层级问题，非数据/Provider错误、非运行调度问题。此前Source布局/滚动/展开修复没有改变日期显示，故当前locale切换仍展示原机器字符串。

唯一SourceTooltipContent为Main、Side与现子对话Source共用；source-date字符串由websearch-service原record grammar采集，urlSource保留原值，SourcePersistence与Message schema保存，不修改这些原契约、数据、角色消息或sourceId。全仓显示日期只有此SourceParts地点，公用time.ts用于执行时间，不新增平行全局策略或配置。现CSS空span已隐藏，无需改样式掩盖。没有调度/队列/唤醒异常，不扩大为无关清理；若出现立即共享横审。

当前公共日期字段允许作者文字、年份/月、ISO（International Organization for Standardization，国际标准化组织）日历日期/完整带时区时间。采用单一UI呈现函数：只有明确YYYY-MM-DD或标准带时区完整ISO时刻才显示本地化日历日；同时验证完整输入可解析和原日历日确实存在，避免Date把2月30日归一化为另一日。仅取作者原格式中的日历日期，UTC（Coordinated Universal Time，协调世界时）用于格式化这个日历日，不把原时刻换成本地时刻。其他已授权string仍忠实展示原作者信息，不猜日期精度或造当前时间；这是同一现字段的数据域处理，不是旧协议兼容、双源或执行后备路径。

原序列化值保留在实际Source payload与Tooltip metadata的title中。格式化使用既有localeTag与原生Intl.DateTimeFormat，不引入新库/异步worker/Rendering阶段。作者/provider仍自然显示，原source详情与URL/文件动作、展开/阅读状态与API（Application Programming Interface，应用接口）authority不变。风险是日期验证/时区/locale反应性或错误字段导致Tooltip损坏；静态思考不能证明页面通过。

## 实施与验收

纯UI改动SourceParts，不新增/修改/运行UI自动化测试，也不建源码文案断言/fixture。检索当前overlay/test的SourceParts/source日期/tooltip/excerpt没有发现此类UI文件。源Date schema/source工具无需变更，所以不以扩大生产接口或后台测试替代显示问题。

修改前方案落盘后实现/构建/type辅助。用完整原238已关闭真实Source做全新fresh schema/config/恢复/租约/容量/持久frontier与原生出生/端口/凭据对资格；显式真实Main Session，90表全行同内容复制，不发送Provider、不新建Source/fixture。不改原259已封存数据。新source-date-260-history-01，开发/ui18198、自建独立IAB（In-App Browser，应用内浏览器），固定900000毫秒。启动前准备sole shutdown、原前台join、独立精确closure、完整日志/12核心表及输入生命周期保管、自身产物退休工具。

真实Sources组/第一来源通过键盘焦点提示，人工截图查看英文Sep10,2026与中文2026年9月10日；自己的隔离origin切换中文/Dark，不动用户23/18107。再复核没有出版日期的第六个真实webfetch来源、长摘录与折叠重开，以及原数据日期/source身份完整相等。只读DOM（Document Object Model，文档对象模型）metadata是辅助，不做自动断言，图片必须实际呈现亲自看。

所有自己页面关闭、唯一物理关闭、原前台实际结果、精确出生/端口/凭据与全行保管后才退休自身文件。索引/相关README、docs:check/architecture-index；范围清晰提交，fetch/merge上游、完整待推送集合审查和正常push。全产品/原生Preview/新实时子Dock/Task/Mission宽矩阵仍未覆盖则明确保留，整体goal保持active。

## 修改复核

新函数复核补充：默认Intl medium日历不显示纪元，ISO年零若直接格式化会变为缺纪元的1年，故Common Era（公元）之前保持原作者日期文字。Source schema仍为普通string，未合成不存在的时间/日历精度；这里是显示域边界，非兼容旧协议。当前实际Source全为现代日期，年零/其他作者字符串没有真实fixture验收，不宣称该宽域视觉覆盖。


## 实际取得方式显示问题与实施分析

05真实中文Dark无日期Source的Tooltip暴露opencorvus-webfetch。全仓查精确来源code：webfetch唯一producer119为该值；read两个真实producer182/222为opencorvus-read；Exa service返回exa。现Tooltip直接拼接provider，故用户看到内部实现名而非来源取得方式。只在现SourceParts单一呈现函数映射已证明的这两个内置来源方式至现i18n键，Exa品牌首字母正常显示；其他已授权provider字符串仍原样显示，不按前缀或关键词推断来源，不改选择、权限、工具声明、模型请求或数据。原provider及日期一起保留metadata title，所有真实工具记录仍可见。追加两语言labels，没有新策略/config/registry或UI自动化。Source文件read的该UI标签未在本轮真实文件Source触发，不宣称文件宽域已验。随后重建并刷新自己的106，固定原900000毫秒不变；复核中文网页读取及日期，完整Source/原生保管再交付。


## 完成事实

原Native02:04:41.907实际0、原前台85149实际0，fixeddeadline02:04:55.700未延长；英/中文真实日期及最终中文网页读取可见，当前main-2ilhYLdf.js。原始metadata title/date/provider及12核心表/19完整生命周期保管相等；长摘录End与重新展开2266.667均实际可读。未知作者字符串/年零与真实文件来源取得标签/最终英文取得方式等没有真人fixture证据，不宣称全矩阵通过。见本轮README。
