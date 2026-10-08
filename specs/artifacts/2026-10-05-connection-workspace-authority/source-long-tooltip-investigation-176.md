# 176 Long Source Tooltip — 只读深度调查 / implementation HELD

## Recall

用户主要诉求是Sources显示，持续gpt-6.1-sol迭代。本片Root授权只读调查，不能产品/CSS/test/helper/runtime/DB/model/UI/Git修改或再次委托。171仍实际运行，尚未闭合，不能宣称整体通过。亲自使用view_image查看既存root-long-source-tooltip-before.jpg，并读同名JSON；这不是个人页面操作。已读SourceParts全部定义、shared Tooltip.tsx/tooltip.css、messages.css、CardParts调用、installed Kobalte0.13.11 tooltip/popper、114 expanded、137长URL/doc调查、158 reading intent和设计token契约。

## 可证现象与直接触发

Root实际1280×720首leaf键盘focus，source title64/detail57/snippet3536/provider3字符。Tooltip宽420、高883.823、top8/bottom891.823，snippet第三span高809.896，maxHeight none/overflowY visible；截图确实Tooltip覆盖右侧内容且末尾/provider超出视口。触发是自然search返回的真实长snippet被完整放入SourceTooltipContent第三span，不是Source数据缺失、focus gate、caption误判或按名字猜根因。Source anchor实际followfalse/top0，阅读pause已生效，此例不能归为158未暂停。

## 当前数据与布局owner

SourceParts ConversationSourcePart保存optional snippet/author/publishedAt/provider。SourceTooltipContent104–112是唯一feature Tooltip内容生产者：label、detail、完整snippet、metadata四真实字段。SourceChip172唯一调用；CardParts165从真实chronological source run投影SourceParts。主Conversation、Subagent与SideChat共享该CardParts呈现，所有URL/file/document分支消费同Tooltip。URL仍实际href/nativeopen；file原authority/selectEpoch验证及range打开；document无虚构资源动作。Key143、current accessor和group count/ordinal保持，不改provider source、持久化或sourceID。

messages.css1068仅grid/gap/maxwidth420；所有span anywhere换行且overflow visible。shared primitive tooltip.css1明确pointer-events:none、caption/normalwrap/现tokenchrome，无高度或长文阅读owner。Tooltip.tsx只包装Kobalte，不新状态。installed tooltip chunk2N4PRSLE67–84是role tooltip的DismissableLayer包在Popper.Positioner内；Popper2CTBMVJ4282–303计算availableWidth/Height，将fitViewport maxHeight施于floating positioning元素，无法自动约束内部883px内容的overflow visible。不能把fitViewport视为完整长内容可读保证，也不应改库或加另一position owner。库原capture scroll关闭Tooltip语义保持。

114解决leaf展开标签可读，137已指出无height约束风险但当时缺真实极长数据；158解决真实focus阅读意图，162缩小message间距，167改变titleless辨识顺序；这些都未改变Tooltip长snippet责任，故旧修复未根治本例。不是一般Rendering或模型结果错误。

## 可访问性及最小单一方案候选

W3C APG [Tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)明确Tooltip不接收focus、Escape关闭、focus留trigger；该文注明pattern仍work-in-progress。不能擅在role tooltip放button/tabindex/交互scroll区，不能给trigger键盘滚动另造输入gate。shared pointer-events:none使仅maxheight+overflow:auto成为不可命中的滚动内容；键盘仍留anchor，长snippet无法完整读取。单纯clip、line-clamp、substring或删provider只遮症状/截数据，不建议。

推荐Root先review语义范围：把实际完整snippet从Tooltip唯一移入现Sources expanded内容的正常文档流，采用已有Disclosure明示按需展开，不做Tooltip双份snippet/隐藏第二数据owner。Tooltip仍只简短真实身份detail+metadata；完整snippet由同source accessor/Key读取、随Source group chronology排列，不改变输入/结果或Source归属。独立Disclosure使用真实标题/现有成熟label体系，不能猜model标题；读snippet的展开沿既有reading intent，原source link动作仍原anchor，不能把整个snippet变链接。是否新增caption locale需Root准入，现调查不提前实施。

Tooltip自身长title/detail/metadata仍可能超高：需要同一feature布局使用Kobalte available-height变量、身份区换行及正常页面完整detail阅读入口一并审查，不能声称移snippet后极端URL/title全解。如Root坚持仅snippet CSS高度策略，必须先给出无需Tooltip内focus、pointer与keyboard都可达的完整正文owner，否则不能资格化完整阅读。建议不要引入Popover新owner或换全局Tooltip以影响无关consumer。

## 风险/影响/未知

实际search4 Source组会增加expanded内容自然高度，shared main/child/sidechat需关注reading pause、virtual measurements及明确returnbottom，不能pin-all/focusrestore/复写scroll。pointer sourcehover与nativeTabTooltip/Escape/Tabnext/Enter实际URL保持；file/document原权限/动作不变。页内snippet需屏幕阅读语义保持真实文本可访问，不以aria-only重复全文替可见阅读。长URL/title/metadata/extreme viewport、同组多Source layout、file/document实际snippet、所有consumer及library privatebuffer均未知。171未闭合，不从这张截图宣布终态或Source oracle成功。

## 有限正向实际验收建议

Root先保存本before原PNG/JSON/source preimage，再独立准入最小呈现变化并types/build/currentservedasset。新的有限genuine自然search请求沿171输入意图和原Sol24/600000/180000/900000，不强制snippet长度、工具、结果count/URL或Provider timing。真实长snippet若未自然出现，记UNMET，不能构造Source。Root真实宽1280及窄883/dock280：nativeTab真实leaf→Tooltip全部身份/provider在视口；完整snippet由正常内容展开可keyboard阅读/滚动，末段真实内容可见；pointer、Escape、Tabnext、nativeEnter官方URL、自然输出期间reading pause及explicitreturnbottom分别记录。短snippet/无snippet/真实4 Sources chronology/count保留，file/doc无自然scene仍未知。全部UI只能人工真实页面/截图，无DOM/source-string/组件/自动UI测试。原171before失败/once及所有历史限制保留，原oracle不为本布局调查重跑。

## 当前状态

仅调查方案，生产HELD；没有添加依赖、parser、cache、timer、focus owner或调整模型行为。Root拥有171当前操作/closure及未来fix release。连续目标ACTIVE。

## 本批最终状态

Root [171人工记录](source-multiple-search-live-171/live-01/root-manual-qualification.md)确认190087ms/24 Sol200EOF/exhaustedfalse/173原5argsONCE0/allclosed。175成熟URLschema修复8schema+1persist0/types95817实际0，173 Root修正后local7DATA0/types89488实际0。真实UI4与3 Sources组/data projection合格不代表不同documents；longsnippet3536 Tooltip883.823>720仍FAIL、childtext2529 growth UNMET。176仅调查HELD未实现，新175提交推送待Root，持续目标ACTIVE。

## Root选型后的唯一最小实施proposal（只方案，生产仍未准入）

### Root four-file UI implementation admission — 2026-10-08T12:24Z

Root fullread176/177/171 Recall, personally viewed actual Tooltip883.823px failure and group4/group3 pixels; verified current SourceChip/Disclosure/tooltip/css/domutils flow plus official APG (WIP).17514c2fa1f normalpush56581actual0joined/freshsame/outgoingempty/secret0/fullhooks, all171 native/page/pairclosed and original173ONCE0. Admit SourceParts/messages.css/EN/CN plus current07 UX note, exact preimages/diffs preserved. SourceEntry uses one canonical tuple helper for existing Key and prefixed excerpt cardExpanded state; permanent display-contents wrapper preserves leaf ownership/inline flow when snippet absent, snippet presence promotes full-width normal flow without replacing link owner. Whole snippet only native Disclosure reading region, focusable outside Tooltip, no new scroll/focus writer. Region maxheight=min(8 existing chip-height,40vh), fullprewrap/wrap/overflowauto/nativekeys; trigger/bodyfocus reuse existing readingintent. Caption Source excerpt/来源摘要. Tooltip removes snippet and retains identity/detail/metadata. No provider/data/parser/Key/count/fileaction changes or UI tests. Type/build/publicsurface/CSS prerequisites then fresh177 real pixels required; extreme metadata/title/URL and allconsumers remain unknown.

Root已选完整SourceSnippet移出Tooltip至正常flow，175本地commit14c2fa1f9aa2c605f541e55b7ad73b479acce3f4/fetchmerge/outgoing仅owncommit已完成，push56581仍hooks；不提前称pushpass。未来只四文件：packages/overlay/src/components/SourceParts.tsx、styles/surfaces/messages.css、i18n/en-US.json、i18n/zh-CN.json。Root另补current07公开UX，child不改架构/共享indices。

### 身份与单状态

全仓SourceTooltipContent仅SourceChip调用，SourceChip仅SourceParts的Key children；CardParts是SourceParts唯一import调用，主/child/SideChat通过同呈现流消费。现Key字段[type,sessionID??null,messageID??null,sourceId]是实际canonical leaf tuple；excerpt状态必须同tuple而不是index、title、URL或邻近Tool猜关系。SourceEntry在现Key槽中接收current source accessor与current index/showIndex，无新cache/map/Signal。若新增excerpt key使原tuple表达重复，可在同SourceParts文件提取唯一private sourceIdentity(source)生成JSON tuple，同时现Key by和excerpt `source-excerpt:`前缀key复用；不是public helper/第二identity。外层Sources group现key语义不改，不把group key当leaf key。

excerpt仅cardExpanded(excerptKey,false)/setCardExpanded单一既有store状态，nativeDisclosure defaultcollapsed，真实source退休/重现按同conversationUI owner语义处理，禁止本地open signal或双写。保持143 Key	current props getter；正常无snippet（不trim改实际内容，仅判真实字符串是否有内容）仍原inlineleaf结构/密度，避免无故所有leaf block。

### 精确DOM与文本owner

有snippet时SourceEntry正常fullavailablewidth wrapper内保留原SourceChip link/button/span，然后一个现Disclosure.Root/Trigger/Content。Trigger用新chat.source_excerpt caption（EN `Source excerpt` / CN `来源摘要`），native summary自身Enter/Space默认，不preventDefault、不嵌套交互在summary。打开时复用pauseAutoScrollForReading(currentTarget)；正文进入focus时同primitive声明阅读。正文是正常HTML region/div tabindex0并以caption提供可达名称，位于Disclosure.Content，全文唯一 `{source.snippet}`，不parse/substring/clamp/复制到aria-label或Tooltip；role region是正常页内阅读语义，不是tooltip/dialog。真实Tab在打开summary后可进入正文，Arrow/Page/Home/End原生滚动正文到末段，不新键盘gate或scroll/focus writer。若nested原生wheel/keys不能保持父reading控制，需要实际Root复验后按机制分析，不猜fallback。

Tooltip保留当前非交互label/detail/author/date/provider四字段，彻底删除原snippet span，仍Kobalte ownsfocus/dismissal/position，不新Popover/trigger/tooltip state；实际nativeSourceURLs/file range/document原动作、leaf aria-label/ordinals/count保持。全文不裁，provider snippet生产/Tool输出/持久化均不动，不隐藏Rendering。

### 单feature CSS owner

messages.css新增SourceEntry/excerpt scoped规则，wrapper仅snippet branch width100%/min-width0，沿当前gap/caption/border/focus-visible tokens，不改Source6/message margin/全局Tooltip chrome。正文white-space:pre-wrap/overflow-wrap:anywhere保真实换行与长token，min-width0、max-height采用现尺寸token合理有界、overflow-y:auto；focus-visible现outline/color recipe，不能outline:none。有界scroll viewport是正常DOM region可Tab/focus，不能把共享tooltip pointer-events改为auto来伪修交互。具体高度需Root实际wide380/narrow280/总viewport验收后确认，方案不预造视觉成功或另deadline/config。

### 边界与验收

只解决本次已见3536snippet导致883.823px Tooltip的责任错位。极长title/detail/metadata仍可能独立超高，不能从移snippet宣称全部Tooltip Height解决。真实长摘要展开后末段必须可见且keyboard native滚动可达；pointer、Source nativeTab身份Tooltip全部可见、Escape/Tabnext/Enter官方URL、naturalupdate reading与explicitbottom分别实测。单组4/3 ordinals/真实chronology和无snippet inline布局需保留。177原自然输入、不强制长snippet；未自然捕获记UNMET，原171失败/once/raw保持。该段仅最小proposal，四文件生产实施未准入。

## Root当前实施与有限资格

四文件/current07已实施，types/build/CSS0；177真实3256字摘要在192px普通阅读区完整native滚动，identityTooltip约70px。详见[source177](source-long-excerpt-live-177/README.md)。原177whole native closure缺失，178生产recovery1/1后pairedcopyclosed；173未运行，未采矩阵UNMET。用户现只允许单agent。
