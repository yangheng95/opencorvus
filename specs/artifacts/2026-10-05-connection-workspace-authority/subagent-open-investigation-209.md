# 209 主卡 Open 入口调查

## Recall

用户持续要求自主体验/修复 Sources 和子侧栏，最新明确只使用单 agent。前一回合206/207阅读位置d63f937c、208可见域名0945cff3已真实页面复核、范围提交与正常push；当前HEAD/upstream0945cff3，工作区干净。前一回合为有进展。本轮追查208主卡Open一次未显Dock，而活动栏能打开同researcher的真实观察；旧105也保留两次pointer（指针）未显Dock而Enter成功的事实，不能把重复观察称为已经定位或模型原因。

## 当前代码与影响面

已读 SubagentProgressGrid.tsx、Button.tsx、QuotationSelection.tsx、Conversation.tsx当前虚拟项目/回调/滚动器/main挂载链、ConversationAgentRail实际打开分支、main.tsx唯一openSubagentConversation/openRightDockPanel/openCenterWorkbenchPanel及workspaceEpoch清理effect。全仓搜索公开回调与pane生命周期：主卡与活动栏都到同一规范入口，主卡按钮stopPropagation后调用一次onOpen(sessionID)，外层article另有点击；活动栏明确对subagent调用同入口并return。Button透传真实onClick，QuotationSelection仅选择工具条阻止pointerdown，没有在转录根拦截Open。父Task切换会提升workspaceEpoch并清理子session，但是否参与本次失败未知。

一个待证实触发差异是主卡位于虚拟主转录内；locator自动滚动到原来在viewport（视口）外的按钮时，tracking仍true，内容测量可能在点击前把视口重新锚到尾部。该路径不能等同人工向上滚动后点击的实际操作。需保存点击前后的真实button geometry（几何位置）、主scroll top/follow、当前source/session/Dock与即时截图；不能注入事件、消息、DOM（Document Object Model，文档对象模型）或UI状态来证明产品功能。现象若只在未声明用户滚动意图的工具自动scroll触发，也只能据实限定结论，不增加产品旁路补丁。

## 观察方案

新209完整原153 runtime副本按205共同启动资格，后台自2f63未变；fresh native/port/pair guard及全90表实际行内容一致。当前生产serve `/ui`和main-L1F0igr8；不重启原153/208，不复制凭据/模型或新Task。自己的独立页面先打开真实Task，在初始尾部观察主卡是否实际可见；再用真实wheel/PageUp明确释放主scroll follow，将研究员卡放入可见视口，分别实际pointer与keyboard激活，确认同session/Dock内容。关闭Dock后从活动栏比较；原工具click观察与真实用户动作分别记录。需要更深诊断时仅当前read-only DOM及原请求/日志事实，不新增UI自动化测试。

实现必须在真实trigger/root确认后补完整数据/控制流、所有共享调用/合同、旧路径不足/风险并先落盘。若没有证明产品root，不做推测改动，保留观察并继续下个真实场景。结束前关闭自己的页面、唯一public shutdown/join原父工具/native/output/request、精确出生身份/端口/pair，文档/索引检查与范围提交、fetch/merge上游/审查完整待推送集合/正常push。持续目标不标complete。

## 209 实际新证据

当前真实Task完成加载，taskSwitch=false，主scroll top1302/height1938/client635/follow=true。researcher按钮实际top-514.0625、tester-316.729187均在屏幕外。复用原locator.click后同位置/follow保持、Dock width0；这复现的是屏幕外自动定位点击观察，未证明正常可见控件不响应。

实际滚轮up1后主top582/follow=false，researcher按钮top205.9375/bottom229.9375、tester403.270844，原Screenshot中清晰可见。按该真实Screenshot坐标点击researcher的Open，立即打开base-researcher/Dock正文；原生产21:45:10.609Z GET该规范session成功200。关闭Dock后tester按钮Enter打开base-tester，规范ses_hmr5hLvn696a1dvBqrh0/top444.666656/height1021/client577/follow=true。再关闭后测试员按钮在屏幕内top255.9375，实际指针点击同样打开相同规范session；最后Control+Home实际查看完整正文起点。所有即时/稳定截图已人工看过，无UI测试或生产改动。

代码证明onOpen回调/规范session入口两路径相同，主卡隐藏几何和follow未释放的自动定位观察与正常用户先滚轮阅读后点击不同。共享测量会在follow=true时落尾，这与屏幕外定位点击后仍在原tail一致；工具内部mouse/scroll发送时序尚未观测，因此不把该一致性写成已证明的内部根因。当前两个可见按钮的pointer与tester keyboard均通过，不等同所有冷/流式/虚拟滚动矩阵通过，也不重写旧105/208原失败。

自己的页面24已关闭；另一个非本轮页面保留未操作，不能宣称浏览器清单为空。唯一public shutdown后原父工具53393实际0，21:47:10.638Z生产Native exited/0、physical/output/request完整，精确Host76764/Target13680出生身份死亡、18129/pair闭合，原deadline1791496726470未延长。本轮先交付明确的观察分类，不加推测产品补丁；下一批优先当前Host下授权GPT-6.1 Sol的真实单Chat流式Sources/主聊天滚动，禁止创建协作子agent或重放原Task。
