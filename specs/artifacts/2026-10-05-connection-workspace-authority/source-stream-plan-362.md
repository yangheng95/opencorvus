# 362 Sources展开与实际流式更新

## Recall

用户要求持续单agent自主体验并修复Sources/Rendering及其他真实问题；原goal中的Astra多agent文字已被最新人工要求覆盖，不委托开发agent、不派遣产品成员。上一轮361是progress：真实长输出发现中文表格逐字竖排，现有表头keep-all修复已通过同一完整历史的宽窄页面/方向键/Source目标与收起，2478c46d5已推送且HEAD/upstream一致。361两个NativeService均实际关闭，原handle49515/33553 exit0，不重开；359首次复制跨网站异常仍未知。长期目标active。

当前已重新读取工作区状态、361 Recall/结果、07-panel-reactivity正文/跟随/阅读恢复合同、SourceParts、CardParts、SideChatPanel、TextPart、dom-utils和conversation-reading-anchor，检索全部同语义调用及相关测试。工作区另有人类授权的国际化/网站/依赖改动，原样保留，不纳入362提交。当前package变更为网站Starlight补丁，不把它当作本轮产品改动。检索出的workspace-source-resolution是数据域测试；不运行任何UI自动化。

## 可观察缺口、控制流与范围

361源码与真实截图支持当前长输出采样帧读点保持，但Sources展开发生于完成后，没有证明流式增长与来源动作交叠。当前SourceParts以首Source的Session/Message/sourceId作为原展开key，各入口以真实sourceIdentity keyed渲染；Disclosure打开/原生焦点调用共享pauseAutoScrollForReading，bottom收起聚焦原trigger并就近滚动。CardParts保持原message与part分段；TextPart保留既有HTML，仅初始无块且pending时显示Rendering。Side选择的原Session绑定一次stream与独立following，读点含canonical来源/正文anchor，当前source/selection改变才重置。

全仓横向读到Main/Side/Subagent共用dom-utils和reading-anchor，SourceParts各展开/复制/打开入口均走现有reading intent。不能根据标题或一个pending标记推断重挂载；需要真实截图变化、原Message/Part与请求事实才改。没有新调度/队列/恢复异常，若出现立即按Task/Mission/Session全部入口/执行轮次/终态/重试/重启/串并行/项目隔离横审。

另一个待证候选：reading-anchor以rect筛选而没有显式排除closed details。361初始观察中折叠Reference history后代仍有非零且落入视口的旧geometry；241也记录过此浏览器事实。241修复的是reference disclosure状态持久化，不能证明本候选无影响。但当前尚无可见错误恢复证据，不能先加selector遮蔽或声称根因。此次辅助采样记录closed-details归属，实际截图判断绘制内容；如复现错误锚定再补数据/调用/合同/风险和实施计划。

## 真实执行与验收

新独立source-stream-362/18360，固定600000ms NativeService，累计12请求预算。使用现有已授权OpenAI auth及完整models.json配对暂存，启动会话前独立确认usable/projected/actual gpt-6.1-sol streaming。真实Web UI /ui先建立简短Main，再串行打开Side检索两目录同名Markdown的16个STREAM362命中，随后持续生成约5000至6000汉字。模型自然工具与正文可见；不改历史或伪造Source/Message、不创建Task或成员。只在预检通过后创建命名隔离输入。

按实际流式窗口人工操作：有正文且Working时展开Sources→核对列表与阅读位置→打开甲目录末条第9行→返回Side→键盘收起→重开Sources/侧栏观察持续增长与完成。选择当前确实可见的入口，截取并亲自查看真实页面；必要时按真实时间读canonical只读SQLite核对消息completed与Provider pending。离散截图不证明所有帧稳定。原型无工具/短输出/已完成导致错过窗口时如实记录，不能把完成后操作冒充流式验收。

只用原生交互和人工截图，不写/运行DOM、组件、源码文案、截图或像素断言。DOM text/geometry只作当前人工时点的补充，排除closed details的实际可见性声明。若有新缺陷先扩充本方案再修根因，禁止叠加fallback、延迟占位或影子状态。build/type/docs用于结构验证，不替代视觉；没有非UI变动就不新增实现镜像测试。

## 收尾与交付

启动前正式build；自有页关闭、公共shutdown、原handle实际join，验证Host/Native/output/request/端口和auth/models配对清除，保存原失败事实；不延长或重启同scope。分离当前Provider、canonical、HTTP、截图与helper证据并脱敏归档。更新spec索引和当前文档检查，范围提交、fresh fetch/普通merge、完整待推送集合审查及正常push，不操作用户窗口/发布/分支。若仅得到稳定证据，明确覆盖范围和未知，不编造产品修复；本批结束目标继续active。

## 362实际结果与下一步

当前8次gpt-6.1-sol实际请求全部HTTP200/streaming/EOF。最终Message msg_g0VXrymGD004FprspYlD在1791837317565–1791837444886间输出，Markdown6644字符/4448汉字，低于计划请求的5000汉字下限，不宣称长度达标；已完成全部主要交叠动作，有真实足够长窗口。源码未改。628→968→2023→2488→3022→3475→4374的实际未完成阶段中，展开16Source、甲目录第9行打开和返回、Enter收起与再展开、全Dock关闭重开成功。canonical分别在file-open-active/dock-return-active时确认completed为空/Provider1pending；最终6422 DOM字符、30块。来源首行在08/10/11相对视口约-0.02px，已完成时File页隐藏Side并缩窄到280px后12恢复相同Source/偏移约-0.24px。全部12张截图亲自查看。

辅助观测一次捕获尚未赋值的Tab，改显式参数后继续；summary的role locator无匹配，按当前AX焦点原生Enter成功；关闭后一次旧序号未重开，09实际关闭画面保留，10当前按钮重开才通过；窄标签实际进入More tabs菜单并经可见菜单返回。这些均不冒充产品缺陷或正确完成帧。截图11虽命名active，实时间在completed之后，README明确纠正。

build62001 exit0；NativeService271072/600000ms内关闭，原30151实际exit0，全链与成对凭据清除均归档。没有新渲染/调度异常。未覆盖长Main的closed Reference history候选：下一轮应优先用已有真实大量Sources主历史的完整副本调查，而不是新增模型输出或先打补丁。359clipboard未知仍保留。docs/index检查与范围提交/push完成后保持goal active。
