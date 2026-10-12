# 350 长消息重排时保持阅读段落

[Recall与完整调查](../main-transition-plan-350.md)。单agent完成调查、实现与实际页面复核。本轮修复共享主Conversation的宽度重排和按键输入登记，未修改模型、Sources数据或Markdown缓存上限。

## 确认的根因与改动

349最初只在阶段交接附近看见跳位；350第一次打开child、仅约3段研究正文时就已复现，所以阶段交接和32缓存都不是必要条件。[原始布局片段](checks/first-open-diagnostic.json)中，同一owner1/epoch2、markdownPending0，宽度927→546，第一可见长用户card由2483→3541px，scrollTop却停在约2425，orchestrator从视口内87px被推到1168px。父组件与已呈现正文没有重新创建。

安装版Virtua0.49.3的item尺寸补偿处理item边界，不保持一个仍然相交的大item内部的阅读段落。主reader旧锚点又只指向整份TextPart及像素，width改变时只contentChanged。现在同一阅读记录保存Message/textIndex/blockIndex、段落offset及viewportWidth，现有measured回调通过原pending/restore/controller保持该段；布局回声不能覆盖旧读点。已挂载目标直接使用原pin，历史未挂载目标仍沿原history/card-scroll。当前其他正文正在streaming不再阻止已有目标段落就绪。

补验发现controller重建后的keydown监听落在主会话自定义处理器之后；其preventDefault让controller漏掉输入意图。共享controller现在以capture阶段登记，清理也使用相同phase；Main读取该controller已有的输入状态，活动键盘/滚轮/拖动期间不重启布局恢复，不另建手势计时器。编辑框、嵌套owner、combobox、slider及修饰键边界保留。[DOM事件规范](https://dom.spec.whatwg.org/#concept-event-dispatch)支持这个顺序选择；实际验收见下。

临时诊断只记录真实几何和生命周期，源码留在[调查构建](Conversation.diagnostic.tsx)，正式源码已精确去掉全部临时记录。ResizeObserver警告完整保留，没有通过屏蔽错误修复观感。

## 实际画面对照

| 图片 | 结果及边界 |
| --- | --- |
| [01](01-initial-source-and-main.png) | 初次打开真实子侧栏，主会话已跳回用户R23附近 |
| [02](02-before-close-long-input-tail.png)、[03](03-closed-long-input-tail.png)、[04](04-reopened-long-input-tail.png) | 长输入尾部仍可见时，开关路径重复出现R35/R36→R23附近跳位 |
| [05](05-fixed-long-tail-before-close.png)、[06](06-fixed-long-tail-closed.png)、[07](07-fixed-long-tail-reopened.png) | 段落修复后，width546/927/546始终保留R35，offset约-10.47/-10.72/-10.47px |
| [08](08-fixed-return-to-task.png) | 切换到真实预检Session后返回Task，R35仍在原位置 |
| [09](09-fixed-bottom-follow.png) | 已在01服务退出之后，**不算在线回底验收** |
| [10](10-online-session-bottom-follow.png) | 新02在线普通会话验证跟随到底部 |
| [11](11-online-pageup-during-resize.png)、[12](12-input-priority-pageup.png) | 两版输入处理均未使该组合上翻，失败画面保留 |
| [13](13-native-pageup-priority.png) | 原生PageUp能上翻到R19，但尚未完成后续在线保留验证 |
| [14](14-native-new-reading-position.png) | 已在02服务退出之后，不能算在线通过；02总体资格失败 |
| [15](15-final-before-pageup.png)、[16](16-final-native-pageup.png)、[17](17-final-new-position-retained.png) | 最终03在线：R31→原生PageUp到R19→重新打开仍保留R19 |
| [18](18-final-immediate-pageup.png)、[19](19-final-immediate-reading-retained.png) | 同一立即关闭/locator.press组合在最终版上翻成功；按键前实际宽度860，处于546→927变化中，重开保持新的R19 |
| [20](20-final-explicit-bottom.png) | 最终03在线回底，following=true、实际最后回复可见 |

20张真实图片均实际呈现并人工查看，[时间点](screenshot-times.json)和[只读几何/动作记录](manual-reading-observations.json)仅供人工关联，没有DOM或像素断言。16的按键前宽度已927，不能把它当动画中输入；18才有860px直接事实。一次原生控制定位被A元素遮挡，重新读取实际控件后继续，没有算作产品成败。普通Session补验使用同样36题长输入，真实模型仅确认收到；没有假消息或人为Source。

## 三次运行与验证

[实际数据检查](checks/actual-qualification.json)验证01的36题原文均由负责人实际完整取得，36次webfetch/Source及公开流对应；37个assistant正文5474字符，Task `tsk_g00VXpv1u90022h0hCd6` 512066ms后completed，worker `ses_hhpfLk7aNEsSfk5buQuE`。40个text流最终值满足持久化trimEnd合同。03另从规范存储逐值验证同一长输入和已结束的真实回复。

| 运行 | 实际请求及结束 | 资格 |
| --- | --- | --- |
| 01 / 18327 | 47个gpt-6.1-sol流式HTTP200/EOF；观察器75162=0，启动55633=0；Native935267ms，Task边界到达后正常退出 | Task通过；05—08在Native退出前，09之后 |
| 02 / 18328 | 4个真实Sol流EOF；启动81777=1，Native599181ms，deadline_exceeded；物理/输出/请求/配对仍完整清理 | **OWNED_QUALIFICATION_BOUNDARY_REACHED，失败原样保留** |
| 03 / 18329 | 4个真实Sol流EOF；启动26612=0，Native219389ms，主动shutdown | NativeService通过，15—20全部在线且在物理退出前 |

三次均分别验证授权凭据usable、完整模型目录projected和实际请求模型一致。自己的140/141/142页均关闭；Native/Host/端口/输出/请求/复制auth+models配对均按精确出生身份闭合。02没有续期或包装成功，03是新的完整短时验收。

最终构建59190与typecheck27988实际exit0，当前正式`main-Byx48Ve-.js`由03真实服务返回200。更早调查/两次修复构建也分别保留原日志与实际asset范围，不能相互替代。无UI自动化测试；类型、构建和日志不能替代上述画面。完整大日志/JSON、监督文本和脚本按[归档清单](checks/archive-receipt.json)压缩，私有原件保留；121份文本及解压内容凭据扫描0。压缩比较只验证真实归档完整性，不作源码哈希验收。

共享实现覆盖Task/Mission/普通Session，但本轮实际UI只验了Task和普通Session；没有独立Mission或触摸设备验收。段落锚点保持同段及相对像素，不能宣称重排后字符级对齐；tool-only区域沿原数字位置合同。原Research Studio全历史、全帧Rendering问题仍不能由本轮替代为全局通过。
