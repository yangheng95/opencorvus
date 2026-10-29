# Sources 操作与默认桌面看板

## Recall

用户要求持续单 agent 自主体验和修复整个当前产品，重视Sources展示及实际可用性，真实页面/截图验证后提交推送；旧Goal的多人文案被后续单agent指令覆盖。Rendering闪烁已解决，不复用旧截图当当前缺陷。797/798是progress：ee2575ba3e160de46406a43b05271a074c6e9e93已正常推送，17:48:51Z fresh main=origin/main、0/0、自有文件已提交；原795代码Task和Mission完整真实验收通过。993次真实Provider请求已结算，所有自有服务/页面退出，凭据/模型目录副本清退；不重开已退范围。更早793的提交审批流程和来源调用成本仍未验证，不以795闭环替代。当前171他人删除、7他人修改和两个缓存目录保留，不开branch/worktree、不委托。

## 实施前分析

已读798 Recall、八张真实截图、SourceParts全部入口、SourceEntry复制/摘录及FileWorkbench目标准入、CardParts来源分组、当前Source阅读/继承/错误恢复记录、Tooltip/Button primitive、MissionBoard与mission-board.css布局。Source普通与侧聊文件链接/行列、复制、错误与Retry已分别有历史真实验证，当前未证新Sources故障，不为提交虚构改动。Sources的ARIA名称和实际链接来自同一源对象；先实页复核，不能从虚拟化离屏时的空AX节点推出按钮缺名。当前检索未发现相关UI自动化，不新增或运行。

现有直接证据：798-05真实1280×720默认展开侧栏的Mission Board，Completed第五列被右边界截断；798-06收起侧栏后五列完整。当前唯一布局定义mission-board.css的.mission-board__lanes用repeat(5,minmax(calc(184px * --ui-scale),1fr))，再叠加原padding与gap。五列保留最低920px，加间距/边距后超过默认主工作区。横向滚动已有但最终结果默认部分在屏外；让用户必须收起项目栏才能看完整主要状态并非理想默认体验。不是数据/终态投影异常，798正式board已证明原Mission completed。

候选只调整这一个现有列最小宽度为160px×当前ui-scale。默认1280场景主区仍有每列约160多px，五个列头、卡片终态和主要操作可以同时可见；更窄工作区仍沿原横向滚动，不隐藏空列、改变顺序/密度字体、自动折叠用户侧栏或增加另一套布局状态。必须实际查看候选是否过窄，不能仅凭宽度计算交付；如不清楚或读不下，则根据截图修正方案。全仓搜索定义/同义实现后只修改唯一CSS值。保留现有本地化文案、数字和无障碍名称；本批没有新字符串。

影响面：仅Mission Board前端栅格布局，Sources先验证当前行为；没有API/SDK、schema/迁移、Provider、队列、Task/Mission/Session协议变更。Source文件只读，不复制旧raw路径作为新消息或重新执行业务测试。若出现调度/恢复/并发/终态异常，先横审共享机制全部生产入口、执行轮次、重试/重启及多项目，再裁决，不预设局部问题。

## 固定方案与验收

使用新隔离UI-only阶段source-board-799，完整复制关闭798库92表178180行、发布和package资料、四处实际附件namespace。只复制完整模型目录元数据，不复制auth、不给Provider环境凭据；RealProviderAudit预算0确保不发送模型请求，累计保持993。现有程序开发serve /ui呈现普通前端产物，不单起Vite；用户18571、真实用户库/项目及窗口不操作。自有QA七文件/Git/index与实际打开的其他QA来源文件只读保全。

基线和候选服务使用各自独立runtime、页面、namespace及进程身份，但共用首次启动前固定的60min物理admission，不续期。唯一诊断shutdown owner从该admission减5min结算余量计算最终预算关闭；实际阶段完成立即public shutdown。3min无真实活动先检查同一handle；当前不进行付费Provider/任务/消息执行。所有inspector与cleanup在服务启动前准备。

先真实页面查Sources：原检索来源组的行列、摘录/复制及文件打开，主会话和窄侧栏中确认呈现；不重复已有罕见边界或编辑文件。实际Mission Board保持默认侧栏展开，保存五列与最后结果卡片基线。基线服务关闭/原exec/native/launcher及物理/输出/请求结算后，若视觉证据吻合，修改CSS唯一最小列宽，普通前端build/类型/语言检查，候选真实同页复核五列、卡片/按钮可读性、侧栏展开/收起、Sources仍可操作及当前语言。

不新增、修改或运行任何UI自动化测试，DOM文本和几何只作定位，实际截图人工判断才作视觉验收。非UI修复若另有发现先补根因方案与正向真实checker。源库逐行、目标原行/正当投影消费、附件及原文件/Git核对；目录元数据副本在原进程完全结算后退休。新增规格和证据同步三索引，当前docs:check与正常hooks，所有自有文件范围提交，fresh fetch/merge审查完整待推集合并自动push。Goal继续active。

## 结果

真实基线799-01再次复现右侧Completed卡片被裁切；代码搜索确认唯一栅格定义，另一处184px是菜单宽度，不属于列宽。当前面板架构07-panel的Mission草稿编辑/执行与单一Board事实合同保持原样。生产修改只有mission-board.css第119行的184→160，未改变字体、间距、列顺序、业务状态或数据。

候选使用当前工作区正常build:vite产物main-rcW3RLPU.js，输出到自有bundle/bin/ui；通过项目原生serve /ui打开，不对用户正在使用的构建目录或18571做操作。799-04与799-06/13实图确认1280×720、280px左栏时五列完整，终态卡片和草稿编辑/开始按钮可读；799-05收起左栏时卡片自然扩展。799-07/08主动把左栏拖到373px，现有横向滚动能到达完整结果列；更窄空间仍需要滚动，不宣称任意窗口/字号五列全显。

Sources先后在原会话ses_-zUQb23QSzzjAhs9qntn进行实页检查：展开原8条文件来源，两个文件/不同实际行列与复制入口完整显示；实际复制得到8行test_invoice.py的4:21、17:34、20:26、24:13、30:13、38:17、44:26及invoice.py的4:5。原剪贴板为空，首次完整items写回API拒绝空数组后，确认当前仍为本次复制内容再用writeText空串恢复，未保存原剪贴板内容。点击44:26来源，右侧文件编辑器呈现test_invoice.py并定位第44行，默认与缩窄后的主对话来源组保持可读。799-03/12是实际文件打开原图，799-11是全部8条来源的可读原图。没有新增Sources修复；该范围没有URL/文档摘录，亦未重新验证侧聊继承或所有Sources类型，不将既有历史验证冒充本轮结果。

本轮有意不复制auth，模型目录完整元数据副本仅供配置读取，两个RealProviderAudit预算0，实际请求均0、累计仍993；截图中的双语“模型配置暂不可用”来自这个隔离只读条件，未把它误报为当前已认证用户的故障。两阶段共用同一个首次启动前固定60min deadline，当前唯一shutdown owner按deadline减5min计算；均提前通过公开shutdown返回200退出，原exec已join 0、native/launcher退出0，physical/output/request结算完整、原进程身份均dead_or_reused。基线余量3503697ms、候选2959481ms，结算后只清退自有模型目录副本，原auth元数据和catalog元数据/字节保持。

真实关闭后的SQLite检查：原798库及基线/候选92表178180行，schema9、integrity_check=ok；逐表全部原行完全一致，没有本轮例外名单或清空/迁移。四处原附件namespace分别17/10/16/24个原文件与对应目标逐字节一致；原QA项目7文件、HEAD 4f0111e3bcf3dea3571f5db546086ec724b0d79f、分支、6个index条目和index原字节一致，实际阅读来源项目3文件原字节与mtime一致。

验证：隔离HOME下执行`bun run --cwd packages/overlay build:vite --outDir <自有bundle/bin/ui>`成功（约80s，保留既有大chunk警告）；`bun run --cwd packages/overlay typecheck`成功；当前`bun run docs:check`成功（351 ops、26 groups）。不运行任何UI自动化，不把这几项冒充视觉验收。新记录与证据三索引同步，正常push hook结果随Git交付事实报告。全部自有页面已关闭。证据见[当前目录](../../artifacts/2026-10-30-source-board-desktop/README.md)。Goal保持active，未覆盖旧793提交审批流程和更广功能体验的未完成项。
