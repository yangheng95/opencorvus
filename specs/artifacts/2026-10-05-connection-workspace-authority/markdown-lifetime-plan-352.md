# 352 长子会话的 Markdown 生命周期实证

## 当前恢复点

本轮为progress，直接建立“可见性变化退休全部正文owner→完成缓存逐出导致再次排队”的实际链路，但没有把暖返回截图包装成可见反复闪烁。诊断页145已关闭，原启动85478 actual exit0，Native445410ms、Host/Native/output/request/端口均闭合，无auth/models。37正文来自真实349历史；最终完整Message45行、Source36行、持久化Provider请求45身份与原历史逐值相等。787条临时实际日志、7张人工查看截图已留存。

临时text-part-model差异与原patch完整逐字相等后精确reverse，当前生产文件差异为0；正式构建21250/typecheck94517均actual0，恢复main-qcEW9nAj.js。诊断构建76195/typecheck9881均0，真实服务实际返回main-BeV-vxc6.js。剩余脱敏归档、docs、范围提交和push。下一批按下述明确根因分开同目标视图与活动请求生命周期，不能先扩大缓存。外部工作区测试/CI改动保留。

## Recall

用户要求持续自主改善 UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，重点 Sources 显示与子Dock Rendering闪烁；最新只使用单agent，覆盖旧goal的并行Astra措辞。351为progress：64来源末尾收起、焦点与读位、8图实证，f755edc17448fdf709bd50ec4376d29f0dca526c已推送。工作区另有mcp-service测试和CI月记录改动，保留。351所有原生服务/页面/构建句柄已实际正常结算。

## 已读与影响分析

重读351/349 Recall、350根因结论，当前CardParts、TextPart、text-part-model、markdown-render及worker、SubagentConversationPanel全部显示分支，以及07-panel-reactivity。349真实37个独立正文、36网页来源已经超过32份完成缓存，但单次截图未证明Rendering是否实际反复可见；350定位的主长消息重排跳位与此是不同机制。

当前占位只在pending且frozenHtml为空时显示；已挂载正文保留旧HTML，cache miss本身不等于可见闪烁。完成结果32项/4000000 UTF-16代码单元，worker内部512块；不得先提高上限或删占位。Subagent面板的目标key稳定，但All agents分支会卸载选中会话；Dock active与真实卸载需现场区分。CardParts用Index分组，晚到Source或Message插入仍是未知候选，不能凭字段命名判根因。

所有生产Markdown消费者经TextPart共享同一个worker与渲染模型，包括主Session/Task/Mission、Side、child、Goals、工具提醒和文档/笔记/幻灯片。worker用数字owner隔离请求，每owner至多一个在途、最新排队和帧调度；dispose移除subscriber与该worker队列，最后subscriber退出时终止worker，但完成结果保留。源码审查覆盖完成、error、队列替换、dispose、locale变化、authority/source切换及多项目同文缓存；当前没有真实队列异常证据，不能据此宣布所有调度正常。若发现队列、恢复或终态异常，立即按共享机制扩展到所有生产入口和业务执行轮次、重试重启、串并行与项目隔离。

当前只增加临时诊断，尚不修生产机制。用现有AppLog记录真实模型owner、create/render/cache-hit/queued/result/mount/dispose的时间、revision、输入长度/短可识别正文前缀、已呈现块数和pending。不会写入消息、Source、业务store或改变worker队列；不加入自动点击、自动截图循环或UI断言。日志可影响时序，必须保留此限制。完成后精确移除临时代码，归档诊断构建，并重新构建正式源码。

## 真实场景与交付

先以成熟只读工具重新检查349完整历史的当前schema、项目配置、恢复/lease/Task/Message/Memory前沿及原精确物理/输出/请求/凭据配对闭合，再完整复制runtime并逐表逐行验证90表，不改数据库/Task/Session/项目身份。新markdown-lifetime-352-history-01，18332/ui，600000ms固定窗口，无auth/models、无新模型、无Task重启，只有自己的隔离页面。

人工先进入长child，停留早期正文；关闭/重开Dock、All agents返回、另一Session往返，逐次真实截图查看。实际日志只说明owner与渲染状态，截图说明当时可见画面，不能从内部pending推定浏览器已绘制占位。若找到根因先补全契约/调用/数据/测试/文档/风险再改，若未找到保留未知。禁止UI自动化测试，相关路径检索未发现专用测试。最终所有服务/页面/原句柄闭合、诊断精确清除、正式构建/类型/docs检查、证据脱敏、根/月/目录索引、范围提交和fresh fetch/merge/push。goal保持active，不把完成态历史当作原Research Studio全帧流式通过。

## 已确认链路与下一实施范围

01首次冷载入拍到多个真实Rendering占位。02已经完整渲染，03以Home停在前言/R01，04 Dock重开、05 All agents返回、07跨Session返回后的截图都已显示正文。因此不能声称04/05/07实际拍到了占位。实际日志显示首次37个child正文均排队，空模型到首块为96—652ms；关闭Dock时37个owner同时dispose，重开创建37个child加2个主会话owner，32个cache hit，前言/R01—R04再次排队193—261ms，另2个主会话正文38ms。进入成员列表再次dispose37个，返回37个中新一组R05—R11等待205—301ms。跨Session返回child再有11个cache miss，315—422ms。这里的ms是诊断模型等待，包含实际调度/负载，不是独立worker计算基准，也不直接等同可见占位时长。

直接触发点在SubagentConversationPanel：requestKey把props.active和目标身份混合，inactive令key变null；displayedConversation和Show均以它为门槛，导致整份文本DOM退休。外层TabPanel已经forceMount，但仅保住32项数字读位Map，未保住正文。All agents外层Show也卸载整个选中视图。main.tsx的active还受Add/overflow菜单影响，代码可证明同路径，未实际点击这些菜单，不将其写成已复现。32份完成缓存仅缓解小会话返回，不能在37份真实独立正文下保持所有内容；增加缓存上限不是根治这些无身份变化的卸载。

下一批拟保留同一canonical target的已呈现视图，只把active用于请求、live订阅和滚动controller的活动所有权。source/session/directory/API authority仍唯一决定实际目标，变更时旧内容必须退休；不保留多份历史DOM，不另建数据cache或fallback。成员列表仅隐藏同一已选视图，不卸载它。现有request资源在隐藏时仍取消；live投影不能仅因隐藏而回退到较旧HTTP基线，也不能在新身份下复用旧数据。滚动controller仍需在隐藏时清理、恢复时按同一Map最近可见位置重建，不能让隐藏几何0覆盖读位，也不能沿用只在onMount一次执行的旧设置。

这会修改当前07-panel-reactivity里“inactive retires transcript scroll owner”的精确含义：退休滚动/读取活动，但保留同目标已呈现内容。唯一生产调用来自main.tsx，SubagentScroll仅局部调用；主/Side/其他Markdown消费者和32/4000000缓存不变。后续需在原37正文真实历史上验证Dock/成员列表/菜单、早段阅读和source往返，再用真实流式样本验证隐藏期间补读与恢复。当前未发现worker执行失败、错序终态、业务Task/Mission调度异常；不得把本次完成态结果当作全部运行轮次、真实流式或原Research Studio长期历史验收。
