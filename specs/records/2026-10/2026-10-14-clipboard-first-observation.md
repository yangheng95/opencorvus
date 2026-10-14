# 首次复制的浏览器观测顺序

## Recall

用户要求持续自主改进用户界面（User Interface，UI）与用户体验（User Experience，UX），主要问题为Sources显示和成员Rendering。最新人工指令只允许单agent，旧goal中的Astra并行文字不执行。旧库已经清理并从当前schema v1自动迁移，本轮不恢复或再次清空数据。

上一goal turn为progress：73664470621ff6b76b84c40c554afadd6ecc8759修复从Sources打开命令面板后点击主题/语言丢焦，真实鼠标/键盘/Escape及设置/新对话焦点分别通过；16张原图、4条实际Sol流、原SQLite来源/消息/Tool绑定和两个Native物理/配对退休均已保留。正常push原19267通过全部hook后，远端CAS（Compare And Swap，比较并交换）因另一个已完成同步先把远端更新到同一736提交而返回1。随后fresh fetch/merge与完整空pending核对、原4762正常push exit0，原ls-remote确认为736；409的搜索交付也已同步。原日志在410 scratch，本轮归档承接，不把首个1改写成0。当前本任务源码clean，保留其他权限、压缩、InteractionCard/Checkbox及文档修改；整体goal active。

已重读410 Recall、359完整Recall/证据和源文件。SourceEntry捕获当前原URL/path，createClipboardCopy等待copyText，再由唯一浏览器host返回navigator.clipboard.writeText Promise；桌面由原Tauri命令写系统剪贴板。没有Source payload能解释另一个406库的旧路径。全仓搜索clipboard.writeText/navigator.clipboard/overlay_clipboard_write_text与相关服务测试；clipboard-single-writer为纯transport精确参数/错误合同，clipboard-api-key-prompt为纯数据分类，均非渲染测试，本轮不运行它们替代真实复制。没有新增UI测试。

## 现有证据和未知

359新页169/170/171首次Source或正文复制显示Copied，却实际粘贴前值，同目标第二次正确；独立MDN页172也首次旧值、第二次正确。先用工具写过自有marker的页167首次产品复制则正确。410再次观察首次复制后截图、实际粘贴和工具读取均为旧406位置；第二次正确；修后17页先读取工具剪贴板，再复制另一个append来源，首次就读取/粘贴正确。早先记录没有分离新标签第一次剪贴板工具交接和截图操作，不能把失败直接判为Source字符串错误，也不能只凭成功重试宣布解决。

[MDN writeText合同](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)说明Promise在系统剪贴板更新后兑现；当前产品await单writer符合该调用合同。已阅读当前浏览器工具故障排查说明：使用已选浏览器的公开API（Application Programming Interface，应用程序编程接口），不读隐藏实现，不改控制机制。工具剪贴板与页面原生剪贴板的具体同步机制未知，网页受控接口的存在不能证明二者每次观察具有相同时间边界。

## 本轮有限、可区分的手工调查

先不改产品，不启动后台或复制凭据，也不新发模型请求。复用已选的隔离浏览器4，只新建本轮自己的公开MDN writeText说明页；该独立网页之前已经真实复现，因此本轮以它隔离OpenCorvus源码、数据库和Provider影响。只操作现有Copy按钮和公开工具clipboard接口；不执行页面隐藏函数、不注入DOM（Document Object Model，文档对象模型）、不创建测试网页/浏览器fixture（夹具）、不把观察写成UI自动断言。

用独立control页的公开clipboard.writeText/readText建立明确的自有非敏感基准文本；不读取、输出或归档未知用户剪贴板。每个新实验页第一次clipboard访问时刻明确记录：A先点击现有Syntax Copy，再直接工具读取；B先工具读取自有基准，再点击同Copy并读取；C按A复制但在第一次工具读取前增加原生复制/粘贴或截图操作，具体下一步根据A/B真实结果再落盘。不同页之间重设control基准仅用于识别来源，不在产品里预写、双写或重试。每次动作通过实际当前页面状态定位，不批量猜按钮；不反复复制同值来制造通过。

如果第一次读取已经正确，再分别在getAXState/getScreenshot/现有browser screenshot前后读值，区分页面写入与观测动作；顺序和所有旧值必须保留。手工查看原截图和工具返回。必要实际粘贴只进入自己的OpenCorvus未发送草稿；当前阶段若独立网页没有可用的安全输入框，不猜输入或向网站提交任何内容。独立网页资格不能冒充当前OpenCorvus新端到端验收。

若结果将问题定位到工具初次交接，修正本任务的观察工作流并回到原Sources复验，同时保留产品首操作的限定范围；不把工具预读当作用户产品修复。若仍未知，明确有证据的边界并继续必要调查，不靠定时二次写入、权限绕过、host fallback（后备路径）或第二剪贴板状态。若有产品根因，先补完整影响/调用/测试/契约分析再改。此阶段无调度、队列、执行恢复或schema修改。

## 收尾

所有自有MDN标签关闭，公开网页只读而不登录/提交；本轮无Provider凭据/模型流资格声明。归档实际顺序、原图和410完整推送结果，更新本记录、证据入口和三处索引，运行当前docs检查，范围提交、fresh fetch/merge、完整pending审阅及正常push。持续goal保持active；Sources长历史/原成员生命周期仍需各自真实证据。

## A/B实际结果与下一步

独立control页18写入并读回自有A基准。新页19此前没有调用clipboard，第一次Syntax Copy后直接readText返回旧A，此时尚未调用getAXState/getScreenshot；随后AX显示Copied，截图01也有Copied，截图后仍A。因此截图不是本次首个旧值的必要触发点。没有再次复制同一按钮把首败覆盖。

control重设并读回B基准。新页20先readText取得B，然后第一次Syntax Copy，readText立即得到writeText(newClipText)，截图02前后均为同值；control页再读也为该新值。两页动作差异是实验页第一次工具剪贴板交接发生在页面写入前还是后，已形成可区分证据；浏览器内部机制仍不据此猜定。

下一步C精确限定：control写入/读回C，新页第一次页面Copy并确认Copied；先由已初始化的control读取，再由C自己第一次读取，观察首次交接是否改变共享可见值。没有新的页面脚本、DOM注入或产品修改。若C再次显示顺序差异，使用公开工具预先记录已知基准来规范后续Sources观察，保留冷页首败，不能把该操作包装成产品复制修复。

C页21首次页面Copy后AX明确Copied；control先读取仍为C，C自己的第一次readText也为C，随后control仍C。B写出的正文此前可从control读取，说明已经参与工具观察的页共享可见结果；未访问工具剪贴板的新页首写没有进入这个可见结果。原截图03和顺序记录保存，未读取工具隐藏实现，因此只界定观察边界，不宣称已经查到内部具体实现行。A/B/C页19/20/21已关闭，control18暂留。

## 回到Sources的当前执行方案

现有证据已经足以避免把该观测差异猜成Source绑定错误。下一步使用当前源码Node Vite独立bundle和同405真实历史，正式开发服务localhost:18525/ui，新namespace clipboard-first-observation-411-live。继续复用已审阅410原Native reader/公开shutdown/固定600秒控制，只换诊断/产物路径和端口；不新建启动框架。该成熟reader有原配对Provider预检，因此本阶段使用用户既有授权auth+完整models、上限8个实际Sol流请求；这修改了前一独立网站阶段的零模型范围，模型调用按实际审计单独计数，不冒充网页Copy导致推理。原模型、无活动和物理期限不扩大。

control只写自有Sources基准；新产品页在任何实际复制前，公开clipboard.readText记录该已知基准。然后第一次且仅一次点击原网页Source复制，实际Ctrl+V进未发送草稿，记录完整URL，清空；再用不同的原文件Source验证值切换，同样各点一次。这个预读是本任务的工具观察准备，没有产品预写/双写/权限修改，不向用户产品流程引入要求。截图和读取都只人工审阅。首次工具交接前的普通桌面行为仍没有本轮原生应用证据，不能据此宣称所有宿主首写修复。

完成后关闭自己的产品页和control18，按精确目标检查正常shutdown，join原句柄，核对物理/输出/request及配对退休；原库保留。只读来源事实保持与405一致。整个411若没有产品根因则只交付调查证据和修正后的验收顺序，不制造产品补丁。

产品页22在初始Loading阶段预读已知基准后，首次URLSearchParams定位点击未观察到Copied，随后焦点是Conversation容器，读取/粘贴仍为基准（05）；没有把它计为成功复制后的旧值，也不能判定一定未执行，因为反馈窗口短且中间工具读取耗时。后续不同README来源单次鼠标点击明确Copied/按钮聚焦，读回和Ctrl+V为原405完整路径（06）；另一个URI fragment来源单次键盘Enter明确Copied，读回/实际粘贴为精确URL（07）。两个草稿均清空未发送。

只读页面事实为同一顶层document、无iframe，来源复制按钮pointer-events:auto、opacity:1，日志无所取范围的error/warn。Source的reading事件只派发阅读意图，Button原生透传事件；没有据AX索引变化猜测真实DOM替换或共享调度异常。工具预读本身不足以把22页第一个未获成功反馈的点击包装成通过。

最后增加一个同服务新页：先完整呈现原Sources，再第一次工具read取得control的自有新基准，使用键盘Enter仅一次激活原网页来源，然后实际粘贴。它分离原首个指针动作和页面Loading时的工具交接，不为原05补写成功；服务仍使用原固定期限，不扩租约。后续不再重试同一未定动作。

新页23的完整呈现见08；此后首次工具read取得ready-page基准，第一次页面键盘Enter复制URLSearchParams明确Copied，读回/实际Ctrl+V精确为原URL（09），草稿已清空。18/22/23全部关闭。然而Root将关闭安排得过晚：正常shutdown准入时Target48796仍exact_live且端口属于它，发送请求时已触及固定600秒，返回连接拒绝；原启动14978实际exit1，Native原terminal与物理/output/request、配对退休原件均存在，不能写为正常shutdown成功或完整scope通过。没有扩大原期限、重用原namespace或删掉失败。

补验方案保持原目标：新namespace clipboard-first-observation-411-replay、同405数据、同当前411 bundle、原8请求/600秒不变。用两个新的自有产品页分别在完整呈现和工具已知基准读取后，第一次指针复制、第一次键盘复制原Source，各自仅一次并保留真实Copied/读回/粘贴结果；补一个不同文件Source值切换。先完成实际交互并立即关闭服务，再做代码/证据分析，避免分析占用活服务期限。若首个指针仍未取得明确成功反馈，保留其未完成而不缩成只验证键盘。全部由单agent执行，不新发工作提示、不派遣成员；模型请求仅现有配对预检，最后按真实审计结算。

## 重跑、结算与交付边界

重跑页25在完整呈现后读取已知基准，按截图10中真实可见的复制图标作一次原生坐标点击；随即明确Copied，读回与Ctrl+V均为URLSearchParams完整URL（11）。不同README来源单次键盘复制也取得原405文件完整路径（12）。新页26完整呈现（13）并读取已知基准后，首次键盘Enter复制也明确Copied、读回/粘贴为原URL（14）。所有草稿清空未发送；自有24/25/26页关闭，立即公开shutdown，HTTP（Hypertext Transfer Protocol，超文本传输协议）200。没有同值重试、产品预写或第二套剪贴板实现。

重跑Native原件为reason exited / exitCode 0，物理完成、输出排空、请求清理与auth/models配对退休均有原件。原启动13147在压缩前已被join调用，压缩后保留的上下文未携带该工具输出的exit字段，再次poll为Unknown process id；因此只报告有原件的生产进程exit0，不补造原工具句柄exit0回执。首轮14978实际exit1和deadline_exceeded仍独立保留，不能被重跑覆盖。首轮shutdown工具chunk b94589实际报“No connection could be made because the target machine actively refused it.”，没有对应成功HTTP原件。

两轮最新生产Provider审计分别2条、共4条实际gpt-6.1-sol流式请求，均status200、reader settled与eof；这些是既有启动预检，不是复制按钮触发的模型调用。只读生产SQLite检查器重新读取原405历史：版本1，两个来源会话、18条消息、14个来源、10个completed工具。逐字段对照原始ID、绑定、payload和消息完成事实一致；无可变源码摘要验收。实际构建原91895 exit0；docs:check为345 ops/26 groups，architecture-index为19 current documents且链接有效。没有新增或运行UI自动化测试。

本轮交付为[14张原图、原顺序与两轮完整结算证据](../../artifacts/2026-10-14-clipboard-first-observation/README.md)，以及410第一次正常push的CAS失败、随后正常push exit0与远端736身份原件。没有产品源码修改：第一条定位点击05未获得正反馈，冷页面工具交接机制和普通桌面宿主首次复制行为仍未知，不能据重跑宣布它们已修复。原Sources绑定正确性和当前浏览器准备完成后的首个实际指针/键盘复制已取得真实证据。持续goal保留active，原成员Rendering问题继续按实际证据推进。
