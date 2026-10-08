# 211 Ctrl+Home/End 与转录阅读意图

## Recall

用户持续要求自主修复Sources/Rendering及功能，最新只用单agent。上一回合209真实可见Open、210当前Host10次Sol流式/来源暂停恢复返回已完成并推送；HEAD/upstream0af8028a、工作区干净，为有进展。210结束后Control+Home/Source locator Tab没有离开follow=true尾部，随后真实wheel返回通过；原未响应样本保留。本轮先复现焦点和modifier（修饰键）归属，不能把wheel通过代替键盘资格。

## 调查与公共影响

已读Conversation.tsx的唯一scrollToBottom动作/Portal按钮与三setupAutoScroll调用、dom-utils.ts所有输入归属/编辑控件/resize/follow逻辑、SideChatPanel和SubagentConversationPanel的当前接口及07-panel-reactivity合同。全仓搜索scrollToBottom/scrollToTop/焦点调用，Main到底按钮未主动转移焦点；焦点是否造成原观察尚未知，需要DOM（Document Object Model，文档对象模型）actual activeElement及真实输入证明。

当前共享onKeyDown对任何ctrlKey一律return，Windows Ctrl+Home/End因此不产生转录上/下阅读意图。普通Home/PageUp会立即释放follow，但Ctrl+Home即使浏览器原生向上滚动，跟随中的resize/虚拟内容测量仍可重新落尾。Ctrl+End不能靠owned downward intent（所属向下意图）重新跟随。这个代码差异不是整段真实触发证明；先用同焦点Plain Home与Ctrl Home对照真实截图/top/follow，确认后才修。

影响面为共享Main、Side Chat、子侧栏，编辑中的input/textarea/combobox/slider与其他转录必须继续保有输入；Alt/Meta/Shift及非Home/End的Ctrl快捷键不应被误判。此处为UI（User Interface，用户界面）输入归属，不涉及LLM（Large Language Model，大语言模型）工具/流程gate（流程门）或后端调度。旧196修输入所有权、206修跨owner位置，却保留全Ctrl禁读的旧条件，不能根治这种原生键盘导航差异。来源身份/数据、Native/Provider和消息生产合同不需改；键盘焦点/原始事件顺序仍待核对。

## 实际观察与待实施

新211全原153 runtime副本按当前205共同启动资格、fresh原Source native/端口/pair guard和90表逐行实际内容一致；后台自2f63未变。当前正常serve `/ui`和main-L1F0igr8，自己的页面/端口18131，不重启原153/210，不复制凭据或请求模型。真实Main尾部followtrue，记录实际activeElement与可见scroll owner；Ctrl+Home即时/稳定，普通Home同scope比较，再Ctrl+End；真实child从可聚焦来源链接/上下文按钮检查所属键盘动作。只用实际交互与截图人工看，不增改运行UI自动化测试。

若真实对照证明modifier原因，实施前补结果与方案：共享onKeyDown只在已有输入归属/编辑控件/默认处理保护内，识别Ctrl+Home/End为原生上/下方向，保留其他快捷键原行为；不preventDefault，不新增全球键盘代理，不给UI按钮造第二滚动实现，不迁移焦点来遮蔽ctrl guard。三调用者继续同接口；保存preimage、更新现行合同、overlay类型/build、同两个真实owner复验及编辑输入caret（插入光标）可见性。未知的更多平台/Side Chat/Streaming矩阵分别标注。

自己有限服务及页面结束前必须唯一public shutdown/join原父工具/native/output/request、精确出生身份/端口/pair；原失败不重写。文档/索引/check、范围提交、fetch/merge上游/完整待推送集合审查/正常push，单agent持续目标不标complete。

## 实施前已确认根因与范围

211真实页面，实际click主内容后activeElement=DIV#chatScroll，nearest data-follow-lock owner=chatScroll，top1302/height1938/client635/followtrue。同焦点Ctrl+Home的即时像素能看到浏览器原生上移，但22:16:51.115Z稳定又回top1302/followtrue；普通Home同owner立即followfalse，22:16:58.916Z稳定top0。随后Ctrl+End稳定top1302却followfalse。原截图与observations保持。这排除本次对照中的焦点/不同owner问题，并和代码ctrlKey unconditional return、后续测量跟随pin形成一致控制流：标准native navigation（原生导航）被漏归类，浏览器动作未被识别为阅读或到尾意图。

本次仅修改共享onKeyDown的modifier判断：保留ownsTranscriptInput、defaultPrevented、Alt/Meta/Shift和所有编辑控件条件；Ctrl仅Home/End可继续到现有上下方向分类。浏览器仍承担实际导航，无preventDefault、focus迁移、独立滚动/计时器或第二接口。旧纯Ctrl过滤路径替换，三调用者无需改签名。先保存原dom-utils精确preimage，再改，补当前07合同，overlay类型/build及同服务自己的页面reload复验。Ctrl+End现有短暂intent到尾识别的长距离/原生动画仍须按真实结果核对，不通过猜测延长期限或增加后备路径解决。

## 当前真实修复结果

类型工具81935实际0，构建19855实际0/52.78s、renderer public surface1/1；最终main-ChaFi5sr在同211实际HTTP200，自己页面reload。相同DIV#chatScroll焦点，新Ctrl+Home稳定top0/followfalse；Ctrl+End稳定top1302/followtrue。原子侧栏规范Source链接实际focus=A/nearest owner=child，旧Ctrl+End稳定top2349.333251/followfalse；新构建同scope Ctrl+End到同尾部followtrue，再Ctrl+Home稳定top0/followfalse，Main保持followtrue。最终canonical ses_hMlVNrRdOLxQf4XhSds7/首Source展开/title+host+完整Tooltip仍正确，截图全部人工查看。

编辑框是实际TEXTAREA#chatTextarea：自己未发送三行草稿39字符，Ctrl+Home的selectionStart/End0、Ctrl+End39；相同main top1313.333374/height1949/followtrue保持。原window.getSelection观察不代表textarea caret，补用真实selectionStart/End记录，不重写弱证据；自己的草稿通过UI清空。Side Chat、其他平台/Meta/Shift组合、很长转录CtrlEnd动画和本次补丁下的真实流式仍未独立验，不能把Main/child短历史推广为完整矩阵。

全仓current setupAutoScroll/reading intent搜索只有当前三调用者及两reading组件，未遇到UI自动化测试。自己的page26关闭，非本轮23未操作；public shutdown、原父工具20951实际0，22:23:30.658Z实际native exited0、physical/output/request完整，原deadline1791498621663内，精确Host72896/Target42916出生身份死亡、18131/pair闭合。原失败与preimage保留；当前一处UI行为修复，不改后端或请求模型。文档/索引/范围提交/上游合并/正常push后继续单agent。
