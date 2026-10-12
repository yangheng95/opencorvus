# 358 文件来源名称与行号的视觉层级

## Recall

用户持续要求自主改进UI/UX（User Interface/User Experience，用户界面/体验）、功能和Sources显示，最新人工要求只用单agent。357为progress：c4b8d5e58已正常推送，Side/child隐藏变宽后恢复同来源和正文、Main回归通过。当前HEAD为该提交，git仅有其他已授权CI记录改动，保持不动。旧goal内Astra并行措辞已失效；整体goal继续active。

已读357 Recall、07-panel来源与reading合同、311字面文件名和空白身份决策、SourceParts全文、fileSourceLocation/sourceLabel/sourceDetail/sourceFileCaption/复制和打开入口、共享Source样式和中英文catalog；全仓检索定义与调用、相关历史。现有renderer相关检索未发现UI自动化；禁止新增/运行UI自动化测试。沿用已有benchmark与computer-use人工真实页面流程。

## 现象、根因与范围

重新实际查看357图10（当前SourceParts/Source样式未被357修改，最近相关提交4f6a38e8b）：381px Side中原第19–28条长文件名逐条占两行，约44px/条，行号以filename:line附在长标签末尾，左侧另有来源序号，用户需要扫描大量重复名称才能找到行号。图片来自上一轮已启动并闭合的真实历史页，作为当前显示基线，不伪称本轮新before运行。

根因是sourceLabel把文件标题与range拼为一个可换行span，file chip与URL共用整段wrap样式。既有目录去重348、末尾收起351和读点356/357分别解决重复caption、退出动作和位置恢复，未给行号独立的可扫描层级。当前功能地址/复制/range都是正确原事实，不应改Source Part或合并不同记录来降低行数。

方案：提取现有文件标题选择为一个事实来源供完整label与实际file chip共用；只在可打开的文件来源行中，把名称和明确的Line/Lines（中文第…行）标签分开。名称保留原字符、单行ellipsis，范围使用不收缩的caption标签，序号与范围角色可区分。完整源标题/路径/range留在原Tooltip和无障碍名；键盘焦点显示原Tooltip，复制仍取完整绝对位置，打开仍用原Source。保留目录caption首次呈现/路径改变重现、自定义标题必需的真实filename caption和附件原名。文件名空白必须使用white-space:pre保留，不能改trim、路径分隔语义或canonical数据。URL/Document标签继续原wrap合同。

影响仅共享SourceParts、对应消息样式、两种locale和07-panel；Main/Side/child共用同一实现。全部原sourceIdentity/顺序/计数/披露/行读点不变。没有API、schema、配置、Provider、Task/Mission/Session调度变更；若发现调度/队列/恢复异常仍按全生产共享机制横审。没有新滚动owner、状态Store或兼容路径。风险为名称过度省略、范围挤压复制、短名称多列布局变化、自定义标题/附件语义和键盘提示；实际窄/宽页面分别验证，不以build代替视觉。

## 验收与交付

使用356-live-02原Main/Side和348-live-01原child完整已闭合历史，当前schema/config/recovery/Message/Memory/物理身份重新检查后逐表90表完整copy，保持原Project/Session/Task。两份新独立scope source-density-358-main/18346与source-density-358-child/18347，各固定600000ms，无凭据、无新模型/派遣；不动用户页面/进程。

正式构建后人工看Main与Side长文件名、同名不同目录、单行范围，实际键盘焦点/复制完整甲乙路径与行号、点击文件选区、宽窄恢复；在原child核对较短名称、多列、范围来源（原read）、URL继续显示完整标题，并至少看中文行号标签。截图实际呈现，根据结果修正再复查；只读DOM几何或剪贴板为观察，不写UI断言。类型/build/CSS/i18n catalog结构检查/docs为补充，不运行源码文案或DOM/组件/快照/像素测试。

每份自建页面及时关闭，公共shutdown并join原handle至实际exit，核对Host/Native/端口/输出/request及原凭据边界。原数据checker使用真实SQLite/HTTP/Native事实，不将历史Provider unavailable当作新模型资格。全部中间失败保留。更新根/月/目录索引、docs检查、范围提交、fresh fetch/merge并审查全部待推送集合，正常push。旧Research Studio大历史/新实时Rendering/附件独立视觉若未实测须明确未达成，不能缩小原长期目标为本轮完成。

## 第一轮视觉反馈与补验

main/18346/页159正式main-CjPpEVA4.js中，Main/Side长名称成为单行省略、行号完整，普通来源row由旧37.8px变为24px。原目录交界caption仍保留，四次原生键盘复制甲乙20行正确，实际甲20行编辑器选区正确，Main宽窄及Side关闭返回保留同来源。第一次点击后立即读剪贴板取得上一内容；此时复制是否已完成没有独立证据，不能归因为异步时序。该观察未计通过，后续可见反馈及真实键盘复制得到正确内容，全部记录保留。原启动28889实际exit0，页面先关，完整收尾。

child/18347/页160发现新的设计问题：英文Line标签使短文件名条目的固有宽度超过701px栏容纳双列的阈值，图16退化为单列。不能用窄栏变好掩盖宽栏密度变差。保留现有flex布局，不增加另一套列宽策略；把范围标签收紧为英文L（Line，行）及中文“20 行”，区间为L10–12/10–12 行。完整Tooltip/无障碍和复制仍使用原filename:range。原图与失败设计判断保留，须新正式构建及独立完整child历史source-density-358-child-final/18349再看宽窄/中文。

实际canonical核对发现348整文件read的来源range缺省，图18应是无范围标签，不能把模型输出“33 lines”伪装成来源1–33；图17也确认URL标题/host未变。多行范围仍未验收。按已授权OpenAI实际端到端方式补充fresh source-density-358-live/18348，NativeService600000ms、12请求累计预算：现有launcher配对复制auth entry和完整models.json，分别验证usable、projected、实际gpt-6.1-sol流式。创建一份真实长名称且带前导空格的普通Markdown输入，用Web UI让普通会话read offset10/limit3，保留实际source-file range与原文件名、复制位置和编辑器选区；不伪造Source，不派遣成员。正文短答即可，模型用量限定在这项真实范围验收。若工具返回其他范围，先以原事实调查，不能手改消息。此补验也需原handle/Native/Provider资格与配对清除，不能借历史available:false冒充。

child原84255及child-final原26045均已实际exit0、页160/161先关闭、完整收尾。child-final英文L标签在701px恢复双列（19），301px范围清楚（20）；真实设置切中文后301px清楚（21），但701px图22仍单列。原观察final-child-layout显示每条334.8625px，两个加gap超过实际content宽度，因此22是未通过的宽栏密度，不能按工具动作标题算成功。中文去掉数字与“行”间冗余空格，range标签横向内距由现有xs缩为3xs（已有token）；不引入新列宽策略，也不改名称字符。新正式构建后用fresh source-density-358-child-final2/18350复核中英宽窄，原22保留。

final2/页162进一步量得中文双位数条目327.8625px，两个加list gap6为661.725px，超过实际content661px；图24出现前段单列、个位数范围处恢复双列，仍未通过。不能由预估字宽或英文通过推断中文；原观察保留。名称与range之间从sm6改为xs4，使用同一现有token规则使两个双位数条目总宽预计657.725px，随后fresh child-final3/18351实际复核，不以计算代替截图。final2原18883实际exit0，页面先关、物理完整收尾。

final3/页163最终中英701px均为双列，中文原行宽325.8625px，实际x20/351.8625同高度配对；301px单列行号和复制保持可见。图25–27与final3-child-layout保留。原38447实际exit0，全链收尾。live/18348/页164用真实gpt-6.1-sol完成read10–12/30，实际Source范围与复制、编辑器三行选区一致，文件前导两空格保留；中英多行范围图28–31均实际查看。原55186实际exit0，NativeService通过5请求EOF，auth/models配对已清除。最后把终版main-CrFGPI-s.js再放回fresh source-density-358-final-main/18352（重新读取全源准入、完整90表），补Main/Side多来源终版截图与实际动作；初版Main/Side证据仍按原asset归档。

final-main/页165视觉图32–35通过名称/行号与真实乙20行文件定位，但复制动作出现异常：同一工具调用中复制后立即clipboard.readText返回前一live范围值，后续再次read和原生Control+V到自建空白草稿也相同；草稿随即清空，未发送。此前初版的4次复制及live多行复制确实取得正确值，不能用这些覆盖本次异常。读取createClipboardCopy/copyText/tauri-transport公开单writer链，只在await navigator.clipboard.writeText(command.text)完成后显示成功，没有可据此修改的已证实根因；当前Source数据也不含另一live私有路径，应用构造错目标与浏览器工具同步需分别调查。final-main原20436实际exit0并及时收尾，异常记录保留，不将其复制项计通过。fresh source-density-358-clipboard/18353用相同完整历史，只做可见真实指针复制与分开工具调用的剪贴板观察，必要时用未发送输入的原生复制对照；不添加浏览器fixture或UI断言，不改产品clipboard实现来绕过未知工具行为。

## 本轮结算与未满足项

clipboard/页166原53710实际exit0并完整收尾。可见指针复制与分开工具调用仍先读到旧live值；自建未发送输入以fill写入clipboard-native-control-358再原生Control+C后读到该对照文本，随即清空草稿。再次执行应用复制后MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）text/plain读到正确乙:2，后续复制乙:3两个读取接口均正确。原成功和失败都保留。document.hasFocus在工具的只读DOM作用域不受支持，失败调用未作为应用证据；图36最初是Loading空内容，已单独呈现复核，不当Sources验收。没有推断工具bug或应用bug为已证实根因，没有改写clipboard单writer。**剪贴板读回可靠性仍未定位/未修复，下一轮必须继续调查；后续成功不能证明早期异常已消失。**

当前视觉修改已完成真实桌面Main/Side/child宽窄、中英文标签、完整Tooltip、目录交界与来源定位；40张图按阶段和失败设计分别记录。Live真实range10–12来源、两前导空格及三行选区通过人工复核；历史全90表复制和实际canonical/HTTP/Native检查通过，UI/clipboard仅人工观察，不作为自动化UI断言。8个原启动均实际exit0且在各自600000ms内收尾，唯一live完成5个gpt-6.1-sol流式EOF及auth/models清除。所有数据/日志/工具原件独立归档，不用摘要校验替代功能证明。

类型20319、初构建8968、后续构建69180/84842/69214均实际exit0；最终CSS、两locale2139键结构检查通过。docs、范围提交和普通上游同步见最终证据/Git。仅来源名称/范围呈现和文档变更，不发布、不升级版本。附件与远端特殊文件名、新持续流式Rendering、原Research Studio大历史未取得本轮独立视觉资格；长期goal active，不能以这项视觉改进宣称所有问题已修复。
