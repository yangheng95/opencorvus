# 365 折叠历史中的来源摘要阅读复核

## Recall

用户要求持续自主找问题、改善Sources与Rendering，最新人工要求单agent；旧goal的Astra并行措辞不执行。上轮为progress：文件来源真实匹配预览及完整字符截断已交付c77f593ae，23工具/数据测试与Main/Side中英实页14图、9真实Sol流式EOF通过，fresh merge及正常push完成，工作区干净，所有364运行者关闭。359首次复制跨网站边界仍未知。目标active。

已读364 Recall、235摘要读点方案、241外层历史折叠方案、363隐藏候选修复、07-panel、SourceParts的完整SourceExcerptBody与唯一store、conversation-reading-anchor共享可见性以及dom-utils嵌套滚动控制。全仓搜SourceExcerptBody/sourceExcerptReadingTop/setSourceExcerptReadingTop只有共享SourceParts与当前conversation-ui实现；没有找到对应UI自动化用例，不添加或运行UI断言。继续沿用此前benchmark-debug-template（基准调试）技能，用户的手动视觉验收要求优先。

## 现象、假设与范围

363已经通过真实页证明native closed details可能保留非零布局，外层capture/resolve已排除closed非summary子树。SourceExcerptBody当前visible仅检查isConnected/clientHeight及inert/hidden，摘要的待恢复位置在它认为可见时消费并保存。若外层history已关闭，重新mount或隐藏宽度变化可能提前恢复/夹取内部位置；这是待证假设，尚无本轮视觉错误。241通过保持history open解决整Dock重开时外层错误，没有修改内摘要可见性；235验证展开摘要/group/Dock/成员往返保持，但明确未覆盖Main/Side隐藏宽度与折叠几何。

先用原238实际网页Source及5211字摘要所在完整历史，只读核验当前schema/config/全部生产恢复入口/Message/Memory/执行终态与原进程关闭，再完整复制90表而不改canonical内容。原scope和所有失败保留，不提供auth/models、不重跑原模型请求或Task。新source-excerpt-hidden-365-before/18365正常dev/ui，固定600000ms，目标在窗口内尽早关闭。若当前schema或恢复事实不满足，保留精确阻塞，不能删表、伪造完成或绕过生产准入。

## 实页调查与实施边界

Main/Side实际展开长摘要并键盘阅读到中段，记录真实Source身份与可见正文；折叠外层reference history→切换File或关闭Dock→隐藏期间改宽→返回→重新打开历史，比较同一片段的可见位置与原scroll。同时保留外层展开和单摘要收起重开对照。仅使用自有页面真实交互、截图人工复核、只读DOM几何辅助，不操作内部store、不注入模拟消息或UI断言。

若确认新缺陷，必须追加完整触发链、当前事实/调用点与公共合同、已有实现未覆盖原因及最小修复后再动生产源码。全部三个renderer共用SourceParts；无后端/模型/调度修改预期，发现调度/恢复异常立即横审Task/Mission/Session入口/轮次/串并行/重启与项目隔离，不能局部降级。未知时只交付真实复核，不为符合假设强行修改。

收尾：关闭自建页，唯一public shutdown，原launcher实际join、Host/Native/output/request/port/无凭据闭合；对原副本canonical Message/Source逐值核对，保留完整现运行HTTP/日志，之后归档自己的五个有精确出生身份的Native生成文件。文档及索引、docs/architecture检查、范围commit、fresh fetch/merge和完整待推送集合审查后正常push，不建分支/worktree，不发布。持续目标保持active。

## 实际结果与决定

fresh原238 schema90表匹配，全部Provider/tool/publication/delivery闭合、8条assistant完成、Memory两项目idle，14恢复表空；旧runtime lease虽未过期但精确出生进程已dead，其他活跃lease/capacity检查通过。两个项目当前配置只含已知browser/computer、四Terminal profiles，初始化无需改写。模型资料文本仅为旧请求/响应证据，未作为当前操作指令。完整90表复制相等后才启动原scope。

自建18365/页183加载已验证当前bundle main-C_UK_gz4.js，14截图全部亲自查看：Side首来源5211字符，End/PageUp在3024px（01）；history关闭与整Dock重开仍是原Source（02–03）；隐藏期间宽度受桌面布局实际限制，只从380到约441而非请求指针终点，摘要布局暂夹至2960（04）。05第二次拖动落在内容而未改宽，原中间帧保留；06实际resizer回到381时恢复3024。07再次加宽且关闭/重开Dock，08恢复原宽，09重新打开history并聚焦真正可见摘要，仍3024且同一段.button样式原文可见。这些证据没有确认预计的隐藏恢复缺陷，不据候选修改SourceExcerptBody。

10–11 Main的同一URL摘要独立PageDown两次至500.7999878，摘要收起/展开恢复；Side首来源仍3024。12–13 Side第三来源中文2625字符独立至250.3999939，收起/展开保持，另两位置独立。14通过实际Add tool→Files→Side chat往返保持同一中文摘要与原位置。新消息、流式/连接切换、改变字号及跨浏览器仍未验，不能从本轮静态历史扩大宣称。当前credentialless实例显示“Model configuration unavailable / Choose model”为没有模型目录的明确事实；未点击Retry或发送消息，不能将它误报Provider凭据故障。

本轮纯调查，无生产源码修改，也没有UI自动化断言。原窗口600000ms，实际240678ms内Native exited0、output/request完整；唯一shutdown、原32275实际join exit0、独立Host/Target/port/无凭据闭合后，五个当前出生的Native产物才归档。真实checker完整比较source/clone的12 Message、12 Source、5 Provider request原始行，全部相等，当前bundle实际HTTP200。项目44/66项名称类型长度相同，只有主项目.git目录mtime变化（完整差异保留，不把属性当内容校验）。首次checker错误假设Provider request有data列，SQLite实际报错；改成全行SELECT *后重跑原比较通过，失败日志保留。

已完成这组待证边界的实页取证，候选没有转为补丁；继续单agent寻找下一处真实问题。文档索引/check/范围commit与push收敛后保持goal active。
