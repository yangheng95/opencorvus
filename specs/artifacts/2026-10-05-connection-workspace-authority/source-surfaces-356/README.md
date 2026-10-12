# 356 主聊天与Side chat来源体验

[Recall与方案](../source-surfaces-plan-356.md) · [月记录](../../../records/2026-10/2026-10-13-source-surfaces-356.md)。单agent开发；真实Main与Side会话先后执行。原用户目标继续active。

## 修复与人工验收

主列表原先只记正文段落锚点。打开File Dock后，长文件名换为两行，旧像素scrollTop1787.2使顶部来源从第43条跳到第30条。见[改变前](15-live02-main-before-file.png)、[打开文件后](16-live02-main-file-line20.png)与[原几何观察](manual-positions-live-02.json)。这是Main阅读位置问题，实际文件第20行定位正确。

现在来源行以原type/Session/Message/sourceId身份及视口offset，接入既有Main阅读位置Store和滚动恢复Owner。正文保留原block锚点；没有新状态源、滚动写入者或消息。正式main-BzN8YRth.js人工验收：

| 实际操作 | 首个可见来源 | 视口宽度 | 来源offset |
| --- | --- | --- | --- |
| [宽主列表](21-fixed-wide-before-file.png) | 第45条，甲第14行 | 942.2px | −8.20px |
| [打开甲第20行文件](22-fixed-narrow-file-open.png) | 同一个第45条 | 561.2px | −8.09px |
| [关闭Dock](23-fixed-wide-return.png) | 同一个第45条 | 942.2px | −8.20px |
| [其他真实会话往返](24-fixed-session-return.png) | 同一个第45条 | 942.2px | −8.20px |

[完整Source身份与原观察](fixed-source-positions.json)。正文补查使用独立history-04，[窄栏暂停阅读](30-prose-narrow-reading.png)与[关闭侧栏后](31-prose-wide-reading.png)仍是同一段，offset36.85→36.70px，两次followLock均false；[原观察](paused-prose-positions-history04.json)。历史副本故意不带模型目录/凭据，图中的Model configuration unavailable是只读副本的真实状态。

## 真实来源和功能

[实际数据checker结果](actual-sources-check.json)验证真实已完成search_code：Main工作会话与Side聊天各64个新Source Part，两份同名文件各32命中，范围2–33。原始[输入](input-documents-live-02.json)、[四次剪贴板观察](copy-observations-live-02.json)核对两个目录第20行完整路径；第20行实际为甲记录19/乙记录19。Side继承的64个来源仍保留在完整canonical中，不能重复计为新搜索结果。

主列表[复制乙20](14-live02-main-copy-乙20.png)、[打开甲20](16-live02-main-file-line20.png)；Side[复制乙20](17-live02-side-copy-乙20.png)、[打开甲20](18-live02-side-file-line20.png)、[返回来源](19-live02-side-return.png)、[独立收起](20-live02-side-collapse.png)。Side返回后仍在47–55来源区域，Main保持自身展开状态。真实Main/Side均有tool与final的原Message对应请求，9次Provider请求全部gpt-6.1-sol流式EOF，包含预检与Memory请求；凭据可用、模型目录投影和实际模型分别合格。

## 运行与范围

| 独立scope | 原启动句柄/exit | 结论 |
| --- | --- | --- |
| live-01，18339，页面152 | 19753 / 1 | 600000ms边界被触发，Native deadline_exceeded/exit1；图01–12及原失败保留，不作为整体资格通过 |
| live-02，18340，页面153 | 25012 / 0 | 完整复做Main/Side，9请求EOF，NativeService资格通过 |
| history-03，18341，页面154 | 54269 / 0 | live-02完整90表历史副本，正式构建来源宽窄/会话往返通过 |
| history-04，18342，页面155 | 72785 / 0 | 同一闭合历史的独立完整副本，正文暂停阅读回归通过 |

live-02及两个history均先关闭自建页面，再公共shutdown，Host/Native/端口/输出/request完整收尾，auth/models配对清除。全部原运行、current canonical、Provider与收尾证据保留在各scope；大型JSON/log以及完整监督链按原文压缩，解压与实际脱敏原文逐字节一致。该检查只验证归档完整性，不作为功能摘要门槛。各scope自己生成的5个Bun pile已在其Host/Native闭合后按精确文件出生及路径归档，其他文件未动。

typecheck72989、build5050、CSS与真实数据checker均exit0。初版checker误假设Main agent=chat而失败，已改为原assistantMessageID和真实agent绑定；失败与复跑日志均保留。文档检查见[日志](checks/docs.log.gz)。[执行脚本及日志](checks/)、[凭据扫描](checks/credential-scan.json)。没有运行或新增UI自动化测试，DOM几何只是人工页面观察记录。

03号图未显示视口外被点击的复制控件，04补充真实可见键盘反馈；25仍在Sources；26–27滚到底部，不能证明暂停锚点；28为窄栏初始跟随，29滚至顶端；只有30–31作为补充正文验收。所有31张真实图保留，未把不合格观察改写为通过。截图和正式构建不能代替原失败scope资格。

此次范围为Main来源读点修复及两个真实来源入口的复制、定位、返回。SourceExcerpt内部、Side/child自身拖动宽度、原旧Research Studio大历史仍未全面验收；继续后续迭代。
