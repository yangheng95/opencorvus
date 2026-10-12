# 327 窄侧聊来源与分隔条修复

2026-10-12，单agent。[先行Recall及逐项修复准入](../source-narrow-plan-327.md)。两轮真实正常开发页面，未运行UI自动化。

## 两个实际修复

右Dock的分隔条原来只声明separator角色，没有最小值、最大值和当前值。实际键盘End已将Dock调为280px，辅助访问树仍给出默认Value50，[读位/属性记录](manual-reading.json)与源码确认属性缺失。现在宽度clamp和ARIA范围读取同一个bounds函数；实际Dock/workspace尺寸经一个ResizeObserver和原animation-frame primitive更新范围及当前值。关闭时保留原hidden/focus规则，当前应用结束时取消frame、断开observer。

第二个问题是在真实拖动中发现的：x838处的1px视觉分隔线可以拖动，而x839开始的拖动没有改变宽度。CSS已有左右各5px的::after命中区域，却被父级overflow:hidden裁掉。删除这项裁剪后，从视觉线右侧约4px（1003→943）实际拖动得到337px，从左侧约4px（938→900）拖动得到380px；沿用既有拖动owner、布局宽度和关闭态pointer-events:none，没有另一套命中层或尺寸配置。

[手动尺寸记录](manual-resizer-after.json)显示键盘步进280→304、最大441、精确线拖动330、导航折叠使max从441到722、重开仍330、导航恢复使max回441；最后两个加宽命中区拖动分别337/380，aria-valuenow与实际约束宽度一致。部分紧随操作的AX帧仍处在CSS过渡，例如284/431，随后同一页面几何与属性收敛到280/441；没有把过渡中间值解释成旧默认50。未进行独立屏幕阅读器语音或所有桌面缩放组合验收。

## 窄 Sources 与实时阅读

live-01真实Side `ses_-zUSCtyO1zzCnSrB0nnt` 读取三个公开来源，280px下完整中文查询可分辨、%7C保留、MDN标题和#参数可读。长Tooltip保持在视口内，原来源点击打开tab103的完整查询地址。[导航记录](manual-navigation.json)来自实际点击。

同一Side后续生成3161字符正文，规范TextPart时间为00:36:13.774Z–00:37:14.327Z。在00:36:28.951Z与00:37:07.403Z的截图中，用户正在读来源，关闭重开前后scrollTop均为543.3333129882812；scrollHeight由3242增长至6051。终态后height6573、scrollTop仍相同。窗口可读高度随提交输入区恢复由448变为366，位置没有被带到正文底部。这只证明实际采样时段；原Research Studio子成员的专属路径和全部帧未由普通Side替代验收。

live-02真实Side `ses_-zUSCr595zzsxweTiHpm` 再次读取MDN来源，修复后仍可阅读、关闭重开。CSS命中区域修复的第二次构建仅刷新自己的tab104，恢复同一已完成Side数据，没有重新派发模型任务、重启Native或延长原预算。

## 人工截图索引

- [04 窄来源2/3](screenshots/04-narrow-source-reading.png)、[05 完整首条来源](screenshots/05-first-query-complete.png)、[06 长链接Tooltip](screenshots/06-narrow-source-tooltip.png)。
- [08 生成中读来源](screenshots/08-source-reading-live.png)、[09 关闭重开后同一读位](screenshots/09-source-after-live-return.png)、[10 终态后读位](screenshots/10-source-reading-later.png)。
- [11 最大宽度](screenshots/11-resizer-maximum-after.png)、[12 精确线拖动](screenshots/12-pointer-resize-after.png)、[13 修复后280px真实Source](screenshots/13-source-and-resizer-after.png)。
- [14 视觉线右侧命中](screenshots/14-outside-line-drag-after.png)、[15 左侧命中](screenshots/15-left-hit-region-after.png)。

01是初始空Side；02是模型简短回复，03及07停在用户输入文字，未作为Source可读性证据。一次Playwright checkbox角色定位没有匹配，随后使用真实AX开关完成操作；未把操作定位失败误判为产品故障。所有截图由root查看，没有DOM/源码文案/像素断言。

## 数据、检查与清理

[后台事实核对](canonical-source-contract.json)只检查真实Tool输入、Source、TextPart时间和Provider结果；不会检查UI标签、几何、ARIA或截图。两轮分别10/6次gpt-6.1-sol流式HTTP200正常EOF，总16次，在各自20/12请求预算内。只使用普通Main预检与Side，没有Task/worker派发。

[类型检查](typecheck.log.gz)44906、[第一构建](build.log.gz)56557、[命中区构建](build-hit-region.log.gz)68311均actual exit0；两次构建声明的renderer公共接口检查通过。[文档检查](docs-final.log.gz)345操作/25组通过。纯UI修改，没有新增/运行UI自动化测试，也没有把类型或构建代替真实页面验收。

两轮原启动执行器2323/39970均actual join exit0；[live-01终态](live-01/source-narrow-327-live-01-qualified-surface-completion.json)、[live-02终态](live-02/source-narrow-327-live-02-qualified-surface-completion.json)记录Native14432/61236和Host63716/72040物理/output/request结束。18297/18298释放、各自auth/models复制配对清理，自己的102/103/104页面关闭。当前进程日志分别13038/9830条，未知时间均0；完整脱敏归档压缩还原一致，私有原件保留。

本轮剩余范围提交、fetch/merge和正常push；持续goal active，未宣称全部UI问题或子成员Rendering均已修复。
