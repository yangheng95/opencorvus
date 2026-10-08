# 213 End 明确请求跟随真实尾部

## Recall

用户持续自主体验 Sources/Rendering/UI（User Interface，用户界面）及功能，授权真实 GPT-6.1 Sol，最新只用单 agent。[实施前方案](../transcript-end-follow-plan-213.md)及四文件精确preimage保存。212真实第二段 CtrlEnd 根据旧虚拟geometry停止在5769/followfalse，而实际maximum8524；原失败、原Provider503资格失败保留，不能重新标绿。

## 当前唯一实现

完整替换共享onAtBottom为必填onFollowRequested，Main、Side Chat、子面板三个caller设置各自已有tracking。End/CtrlEnd在现有归属/defaultPrevented/modifier/编辑控件检查后同步请求跟随，复用现有ResizeObserver（尺寸观察器）与requestAnimationFrame（动画帧调度）收敛真实尾部。焦点与owner之间实际垂直溢出的auto/scroll/hidden框保持本地End；Arrow/PageDown仍当前运动意图，Home暂停不变。无兼容回调、平行状态、preventDefault、计时预算延长或模型路由改动。现行07合同同步。

## 真实页面与人工视觉结果

开发模式18133/ui，实际资产main-Bg2eNYXQ.js，自己页面28，沿用212的两段自然请求；无UI自动化测试。实际Session ses_-zUSUqRtKzzhTi3AMNfG，未委托。初次Sources展开时第一段仍Running，来源标题和www.w3.org清楚可读；正文从2003到4063字符，阅读top320/290在对应操作后保持暂停。点击展开工具使位置变化是实际输入，不宣称不同操作之间像素恒定。

第一段[流式CtrlEnd](live-01/first-long-end-a.jpg)：6446字符、height5796/client635/top5160.666/followtrue；[持续增长](live-01/first-long-end-b.json)7320字符、height6523/top5888/true，仍Running。

第二段从[Sources旧视口](live-01/second-source-before-end.jpg)执行CtrlEnd时仍Running，height7346/top320/false，尾卡未挂载；[即时新尾部](live-01/second-unmounted-control-end-a.json)挂载836字符，height7698/top7062/true。下一增长观测height7853/top7194与当帧新maximum差24，保留这一真实帧，不把输出变化中的采样说成精确静态尾部。[稍后增长](live-01/second-streaming-growth-tail.jpg)1951字符、height8509/top7874/true，最终[完成态](live-01/second-streaming-growth-tail-b.jpg)3661字符、height9631/top8996/true。完成后CtrlHome卸载尾卡，回Sources再CtrlEnd，稳定[最终截图](live-01/second-completed-unmounted-end-b.jpg)8996/9631/635/true。此时总高度已测过；同212“完成态从未测尾卡”的窗口并不完全同构，首次未测卡的直接证据是上面的真实流式跳转，不能伪造已完成估算高度。

实际WAI工具payload height8226/client359。首次点击正文后焦点仍chatScroll，End正常操作外层；这不是嵌套guard通过，原[nested-tool-end-a](live-01/nested-tool-end-a.json)保留。沿真正Tab顺序经过工具按钮进入msg-tool-payload__content；End将本地top0→7866.666，外层521.333/followfalse保持。按[真实焦点截图](live-01/nested-tool-focused-end-a.jpg)人工复核，稳定[局部/外层事实](live-01/nested-tool-focused-end-stable.json)保留。native editable caret在未发送隔离draft中CtrlHome0→CtrlEnd42，外层8996/true不变；draft已清空。

## 当前检查、模型与闭合

overlay typecheck原工具63799=0；build原92402=0，50.10s，真实renderer public surface检查1/1；这些仅源码/构建证据，视觉结论来自上述页面。credential/catalog/actual request三重preflight usable/projected/gpt-6.1-sol streaming及完整配对原事实保留。原父工具63868=0，8次实际模型请求全部streaming200/settled EOF（End of File，流结束）；Native正常exited0/physical/output/request完成，固定600000ms内唯一public shutdown，没有重启延长。独立出生身份检查Host61972/Target54756 dead_or_reused、18133无listener、auth/models副本都已清理；页面28关闭，用户页面23不变。

原库只读6消息/2个canonical来源，第一段raw8104、第二段raw4218；当前14961 redacted日志行/unknown0，原私有runtime保留，凭据内容不写证据。212产生并被213观察器复用的5个native debug pile按精确出生时间移到忽略私有目录，212保留custody receipt，未提交二进制。

## 未覆盖范围

此次修复三个caller已同步，但新213流式时序只人工实测Main；Side Chat/子面板同版本新End时序尚未逐项实测。此前211子面板modifier场景证据仍仅覆盖当时版本。纯横向table、其他平台、长恢复历史首次未测完成卡仍需后续真实复核；旧212 Provider503资格失败保持失败。本轮没有宣称持续总目标已完成。
