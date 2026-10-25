# 既有成员的真实流与 Rendering 生命周期

## Recall

588继续用户授权的长期产品迭代，单个编码agent，不创建子agent/新成员或委派，只在实际冲突需要用户决定时等待。前次完整goal turn为progress：06cde5f42修复来源/正文附件错绑，50个后端正向合同与真实Sol/HTTP/实页/持久化核对通过，正常push后fresh0/0。随后被中断的turn只读取代码，没有启动新的scope或留下本任务文件改动。587的原exec19145/native97828/launcher0，physical/output/request/出生链闭合，页266关闭，配对auth/catalog清退。源577 schema6/90表207330原行字段时间/canonical/95682560字节/mtime1792828797672.7832保持，目标8自然变更单列。Dock35个旧renderer采样不等于其自身流式验收，原高频Rendering仍未复现或定案。

2026-10-25恢复时当前HEAD1443c8482，另一个会话已提交ec4f2715c的每Message一次actor投影优化及PDF/Word改动。当前只有两份共享README的他人未提交修改、171项删除和两缓存目录，均保留。源码相比06cde仅PdfPreview发生前端变动，本批仍重新用Node构建当前前端。已读587 Recall、当前AGENTS、07-panel/reactivity、SubagentConversationPanel/TextPart/model/worker、公开Session prompt schema/route、Mission public authority、WorkerTurnDescriptor与runtime contract；全仓定位prompt当前目录实现，不沿用已删除的prompt.ts路径。当前迁移列表仍1–8，不改已交付迁移。

## 调查前分析与范围

原现象是非虚拟成员Dock反复显示Rendering。当前TextPart仅在有源文本但还没有HTML时显示它；已有HTML只有源真实变空才立即清空。候选包括owner退休/重挂、Part索引换绑、暂时空源、分组/上下文分支更换，不能用延时隐藏提示或直接按Index推测修改。旧Main虚拟缓冲修复不能证明成员Dock已解决；587只在Main流前后采样了静态成员，本轮改为观察该成员自身真实流。

源库只读确认现有ses_-zUS0WzzQzzDOGrIbYwN，kind assistant、39条消息、parent ses_-zUS0X33CzzWEKMgCk98、project prj_hSQinOa1MIVoNEeARpn5，worker_turn_descriptor记录数0。公开POST /session/:id/message接受普通assistant用户输入，原Mission权威和Task投影worker拒绝保持；不绕过这些合同，不重建父子身份、隐藏消息或注入Part。请求会由公开路由自然产生真实User及模型/Tool消息，沿用原Session和原模型身份，仅运行一次既有会话中的有限回复。这是产品真实路径验收，不委托另一个编码agent，也不创建任何成员、Task或Goal。

数据/控制流从caller-minted固定输入Message ID，经公开Session身份校验、流式Provider、持久化/GlobalBus、父会话成员投影、Dock全历史读取与live reconciliation，进入CardParts和TextPart/worker。记录真实backend事件的身份、顺序、类型、长度，与浏览器中同一个Part的owner/HTML块数/真实pending交叉；不根据模型自述、最后错误或最终排序推定事件到达顺序。若发现执行/队列/恢复/并发/终态异常，先立即按共享机制横审Task/Mission/Session所有入口、轮次、正常/终态、重试重启与项目隔离，再决定修复。

当前无产品修改结论。先获取实际复现；若成立，再补根因、全调用/契约、旧修复遗漏、数据/测试/文档/交付/风险后实施。UI修改只允许真实页面手工交互、截图人工查看，不增加或运行UI自动化测试；非UI改动须正向聚焦合同与真实checker。不能把console/DOM统计代替视觉验收。

## 实页与物理边界

从完整闭合577原源/canonical/PNG复制fresh隔离native开发/ui，端口54083，用户18571和其窗口不操作。当前Node Vite构建只增加私有被动观察：精确Part绑定、TextPart owner/源长度/HTML块数/真实pending/退休、Dock scroll owner写入console与DOM属性，不修改产品状态、队列或判断通过失败，不添加UI断言。观察只针对已有目标成员，记录不含凭据或正文全文；不得再以旧非响应式data-observed-pending代替真实pending。构建前后核对隔离DB大小/mtime，构建不迁移数据库。

配对复制当前OpenAI OAuth与完整model catalog，启动前在目标目录验证凭据注册、gpt-6.1-sol投影与原Session身份，实际请求必须精确Sol且流式。预算最多6次（工作、记忆、所有后台合计）；只向该既有会话的公开接口发送一次输入，固定Message ID，不重复发送。请求一次已知W3C Tabs/text，预告后根据真实文档写20个编号节约6000字指南，带LIVE588START/END，不搜索、不重试换站、不读写文件、不创建任何成员。失败保留真实结果，不能临时替换或扩充已用scope。父会话/UI Dock先载入，再启动请求并连续手动查看流中截图、读Source、上滚/回底，结束后复核所有原readers和持久化。

请求观察使用真实进度重置的180秒无活动超时，不把一次观察超时当进程终态；原HTTP/native句柄保留并join。scope物理最大期20分钟，至少提前5分钟public shutdown，所有Provider原reader EOF、exec/native/launcher/physical/output/request/精确出生链闭合后清退凭据与目录副本。源90表全原字段/时间、配置、bytes/mtime及integrity保留，目标正常8及自然变更单列。新spec/产物同步三索引，docs/index及必要类型/功能验证，范围提交、正常fetch/merge/全集检查和push，保留他人共享README差异及删除。

## 588原运行结果与验收客户端修复方案

54083原运行已关闭：public shutdown200、提前647683ms，原exec37311/native与launcher均0，physical/output/request与精确出生链闭合；三次精确Sol流均200且原reader EOF，配对副本清退。GET真实转录42条117 Parts，既有39条之后自然增加User、含一次webfetch的预告、6470字符最终正文；该成员idle。真实截图覆盖正文641/1756/2617/4432/5185/5998可见字符及来源流中阅读、结束后重开。同一正文owner47、Part和scroll owner1在这些人工采样保持，不能排除采样间瞬态，不能宣称Rendering根因已修复。

公开POST调用者原exec85377退出1：Node fetch在发送后约300秒发生UND_ERR_HEADERS_TIMEOUT；当时后端仍输出，约6秒后正常终态。180秒真实活动控制器未超时，触发点是fetch内部响应头计时，不是Provider终态、执行调度或数据库异常。权限对话框和内联按钮同名导致首次点击歧义，后按真实dialog定位允许一次；这延长了等待但不能解释后端失败，因为后端完成且三个原reader EOF。Sources复制显示Copied，但浏览器剪贴板读取为空，字节结果未核验。结束后的console读取为空且覆盖了早期私有快照，不能当全时段生命周期证据，使用明确的截图和人工采样边界。

先按benchmark-debug-template修复私有调用者：用Node原生HTTP的单个请求替代fetch内部计时，不重发旧Message ID，原有真实活动AbortController保留且完整读完公开响应；正向实际HTTP合同覆盖持续活动超过无活动阈值仍200/EOF、真实停滞返回明确Abort错误。再运行fresh 588b隔离scope/54084，复制同一只读577原源，配对凭据/catalog、目标Session和精确模型预检、预算6和20分钟物理上限不变；使用全新固定输入ID，只发送一次。复用当前588已完成且未变更的私有前端publication，复制到新native不可变资源所有者，不构建或切换用户进程；先核对涉及前端的源码差异为空。原scope不复活、不追加请求、不伪称POST成功。新scope仍实际UI流中/终态截图，原HTTP/native句柄join与副本清退，完整原数据复核，然后文档检查、范围提交与正常推送。

## 复验、结论与交付边界

588b/54084复用当前main-y7uKloOv.js，启动前确认前端源码相对1443c8482无差异。私有原生HTTP调用者的实际正向合同通过：持续活动675ms（无活动阈值150ms）取得原200/EOF；真实停滞取得AbortError/PUBLIC_PROMPT_INACTIVITY。fresh公开输入ID只发送一次，原exec77273完整取得200、finish stop、6769字符正文，退出0；没有重发588已经完成的消息。真实流中截图15/16分别2062和4946可见字符，结束17为6287；owner47、真实Part及scroll owner1在人工采样保持。内部pending切换而HTML28至84块持续保留，不等同反复Rendering。1294条去重被动console记录来自有500条上限的窗口，存在观察间隙，不能宣称全流连续覆盖。17张截图均来自两个真实native /ui页面，已经人工查看，未创建或运行UI自动化测试。

两轮均39→42消息、117 Parts，真实User/一次webfetch预告/最终正文完整可见。公开GET经当前生产解析器读入，并在原进程关闭后通过当前completedToolExecutionResult读取真实持久化Tool receipt：Source为4095字符/字节，Tool output6521字符/6523字节，来源Message/Tool归属与持久Part完全一致。588最终正文4478条真实文本事件、588b4711条，均只有初始0长度事件，后续按前值追加，未观察到已经接受的非空源退回空文本。该证据排除这两次具体执行中的源回退，不能替代其他真实发生轮次的根因调查。

588b原exec75390/native80820/launcher退出0，公开shutdown200提前941382ms；physical/output/request闭合，host97384与原target精确出生链均dead_or_reused，3次精确gpt-6.1-sol流200且原reader EOF，auth/catalog副本清退。两个scope源577均90表207330原行字段逐项复核，source DB仍95682560字节/mtime1792828797672.7832/schema6，原canonical配置完整，目标正常schema8且integrity ok。目标5个原行的自然变化仅memory_chunk、memory_file、两capacity lease、该child Session更新时间，详见证据，不能写成目标所有旧字段完全不变。用户18571与窗口未操作。

本批只有可审查的实际体验/后端读取/原进程闭合证据和验收HTTP调用者修复快照，没有产品实现修改。原高频Rendering仍未复现、根因未定；Sources复制只核验Copied反馈，内置浏览器虚拟剪贴板为空且粘贴受同一边界阻止，真实字节未核验。真实复验135秒，没有再次人为延长到300秒以上。下一步针对原密集多Source/Task成员的真实更新轮次追查身份与生命周期，仍只用当前一个编码agent，不创建成员，不注入或合成消息。文档/架构索引检查和正常hook收敛后范围提交，按当前upstream fetch/merge、审查完整待推送集合并push；他人删除、缓存与共享README改动保留。

## 已完成检查

本轮`bun run docs:check`通过（350 operations/26 groups），`bun run check:architecture-index`通过（20份当前架构文档、链接有效）。当前Node前端构建通过且构建前后隔离DB大小/mtime相同，迁移只发生在两个显式隔离native启动时。实际公开转录与持久Tool receipt核对、原HTTP调用者、6个Provider原reader与两个原进程闭合验证均按上述边界完成。未运行UI自动化测试或无目标全量bun test。
