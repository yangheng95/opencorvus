# 持续迭代第三批：用量自然周期、时间桶与控件生命周期

## Recall

用户要求持续按批次并行调查UI/UX（User Interface/User Experience，用户界面/用户体验）、功能与缺陷，直到明确停止；每批先根因与影响分析落盘，再修复、真实桌面页面交互截图人工复核、聚焦正向功能测试、必要且授权的GPT-6.1 Sol端到端、提交/upstream同步/正常push。前批0d59082bb与ff879cabb均已正常push；第二批hook、push返回0且HEAD=origin/main。持续目标active，没有新版本或发布。

本轮开始HEAD ff879cabb，当前main跟踪origin/main。其他任务的session/message-store、source-persistence及并发测试、ComposerModelSelector和共享spec索引/02-data/07-panel改动全部保留，不创建分支或工作树。仅一层两个现有只读分工：功能分工调查Usage时间合同，UI分工审计页面投影/控制。主agent已重读第二批Recall，并读取UsageStats完整实现、usage-stats测试、UsagePanel和SegmentedControl、services/usage、06-provider/07-panel公开合同。全仓搜索resolveWindow/aggregate/read/nextBucket及/global/usage：只有global路由→UsageStats.read→唯一账本与官方统计；SDK（Software Development Kit，软件开发工具包）和Overlay消费同一响应。现有测试覆盖纽约整小时跳变空桶、上海月/年；未覆盖有记录的半小时和午夜跳变。当前检索范围未发现UI自动化测试。

权威资料：[Luxon calendar math与time math](https://raw.githubusercontent.com/moment/luxon/master/docs/math.md)说明小时为固定时长，日/月/年为保留低阶字段的日历运算。沿用现有成熟库，不手写时区表或新增时区配置。

## 现象、触发与共享根因

功能分工已用当前生产函数实测：Australia/Lord_Howe在2026-10-04与2026-04-05的23.5/24.5小时自然日，4条/400Token汇总却只有1条/100Token入桶，最后一个桶越过周期终点。America/Santiago在2026-09的月与2026年统计，3条汇总只有1条入桶；2026-09-06午夜不存在，当前日结束错误保持到次日01:00，次日00:30被纳入当天。主agent代码复核与分工结果一致。

直接触发：窗口开始被库调整到实际01:00；直接plus日历单位保留该小时。数据根因有两处同义边界分裂：resolveWindow没有重新取得相邻自然周期起点；aggregate用每条记录startOf(hour/day)建键，却按周期起点plus小时/天生成另一组桶键。非整点偏移或不存在午夜后，两组键无法相等。原纽约空桶测试只证实数量，无法证明记录归属和桶合计；旧上海正常样例无法根治非正常时区边界。

横向影响已覆盖day/week/month/year、前一周期、小时/日粒度、provider/model总计、峰值/热力图/日期、官方统计输入窗口、全局HTTP（Hypertext Transfer Protocol，超文本传输协议）读取。SDK字段、路由、账本数据不变，不重写历史事件。代码仅用量查询与投影，不控制Task/Mission/Session调度、唤醒、队列、重试、恢复或运行轮次；当前没有这类异常事实，明确排除本批修改。官方统计外部接口尚未实调用。

UI独立候选：UsagePanel period/revision effect立即setData(undefined)，周期SegmentedControl和刷新按钮却挂在Show(data)内，因此切周期/刷新会卸载当前焦点控件。此前鼠标检查没有覆盖键盘连续操作。主agent须先在无凭据隔离真实页面复现，再实施控件生命周期修复；单凭源码不算UI通过。服务连接authority已由apiJson同步读取形成响应式依赖，不能误报为切服务器不刷新。

另发现官方tokens:null但costUSD有效的partial（部分成功）事实被tokens条件隐藏，这是独立投影问题；真实partial页面未验收，留待后续单独处理，不用虚构官方响应充当本批完成证据。

## 实施方案（源码修改前）

1. 相邻窗口用plusPeriod后再次periodStart，保持唯一自然周期合同；周一周起点和原默认period不变。桶按一个真实半开区间序列生成：hour从自然起点逐个经过一小时，day/month重新取下一自然起点，末桶截到current.end。半小时跳变可显示HH:30，现有标签支持分钟。
2. 删除记录startOf键与桶起点的双源。把当前周期记录复制后按occurredAt排序，沿上述实际区间一次归集，保持原记录/账本、provider/model汇总和费用精度合同。覆盖无序输入、精确边界、回拨同名当地时间的不同真实时刻。不得增加后备桶、丢弃记录或重算哈希当验收。
3. 功能分工仅修改usage/usage-stats.test.ts，先补正向案例跑原代码，保留失败证据。覆盖Lord_Howe前进/回拨及两个不同UTC（Coordinated Universal Time，协调世界时）偏移01:45、Santiago日/周/月/年、正常上海/纽约/闰年/周一、总计与各桶Token/金额/次数、末桶精确结束。现有裸toThrow别名测试改成明确Zod（schema库）custom issue/path/message错误合同，避免只断言失败。主agent实现产品并独立复核。
4. 真实账本→真实/global/usage HTTP功能验收使用隔离运行目录中的明确人工测试事件与当前2026年查询，经过production writer/DB/路由，保存返回总计和桶合计；不增加测试时钟公共接口，不改系统时钟，不冒充真实Provider计费。纯函数测试、实际HTTP合同、空服务器页面交互分别注明范围。
5. 主agent以独有`.tmp-codex-usage-01a133`/18573开发源码listener/recovery和私有前端构建进入/ui，先截图基线，再修改并用新scope/快照重验。只关闭自有页面与服务，取得实际stop/exit与物理端口事实。没有独立Vite服务或UI自动化测试。
6. UI若真实复现，活动标题/周期选择/刷新工具栏保持挂载，数据图仍走现有loading/error/current data合同；不保留旧周期数据作新数据，不加focus计时器。按当前目录中英控件文案和日期展示。真实连续键盘切周期/刷新、鼠标操作及中英文截图人工复核；加载和错误状态只有实际取得时才计验收。
7. 更新本spec、当前06-provider用量合同/07-panel控件合同、双语未发布日志和相关索引。聚焦统计/账本功能runner、相关类型/目录/构建/docs、正常pre-push。按范围提交，fresh fetch→merge upstream→完整待推集合审核→必要复验→正常push。持续目标保持active。

## 当前进度

此处最初状态：根因与全调用分析完成，准备正向基线与页面复现，产品源码尚未修改。本批不需要模型执行，不读取/复制真实凭据。后续实施与最终结果如下。

真实/UI基线已完成：18573无凭据服务打开英文Usage，This year→Left聚焦This month→Space后月份切换正确，但group-cl-229替换为group-cl-240且焦点成为页面。无额外定位再Left/Space仍停在月；点击Refresh再次替换group为251并失焦。period-before/refresh-before截图已人工查看。UI根因已实证，不以源码推断代替。UI分工复核保留原布局顺序的最小方案：三段Show围住overview/meta、activity grid、下方insights/official/models，activity section/header/toolbar保持挂载；加载占位留同区域。刷新使用仓库既有aria-disabled/aria-busy及loading点击抑制范式，避免临时native disabled让聚焦按钮再次失焦。无延迟focus修补。

## 独立复核新增午夜回拨（继续实施前）

原基线20项13通过/7失败；首修后连同stream-ledger共22项/142断言通过。但功能分工继续横向检查发现America/Havana在2026-11-01重复午夜：中午查询day时startOf选择第二次00:00-05，而前一次00:00-04是真正自然日起点；两个00:30实际被分成current1/previous1。month统计也把第一小时计入10月，11月2日和12月的previous窗口同样遗漏。该问题仍属于同一自然边界双义性，不能因已有绿测试而宣称修复完成。

当前Luxon公开[getPossibleOffsets](https://moment.github.io/luxon/api-docs/index.html#datetimegetpossibleoffsets)提供两个合法实际候选。统一periodStart先startOf，再由这些真实候选选择最早时刻；resolveWindow的current/previous、nextBucket的day/month都复用它。hour仍按经过时长推进，不把回拨时重复小时折叠。无需手写时区表、平行边界解析或后备路径。新增正向样例须先在当前中间实现复现，再修复；保留首修22绿输出为中间范围证据。继续覆盖从第一/第二午夜及中午观察同一周期、两个实际00:30归属、previous day/month、日/月桶完整覆盖。

## 最终实现与验收

UsageStats唯一periodStart实现取startOf的最早真实候选，当前/相邻周期和日/月桶统一归一化；小时保持真实经过时长，末桶准确截断。删除记录startOf键Map，复制排序当前记录并沿同一个实际半开桶序列归集；provider/model总计、账本、价格、官方API输入合同和SDK字段均保留。独立功能复核没有新增阻塞。

UsagePanel仅将overview、activity数据和下部内容分段依赖data，activity/header/period/refresh始终挂载。loading保留在activity区域，仍清空上一请求数据；刷新沿已有aria-disabled/aria-busy和loading点击抑制，不加延迟focus或影子状态。中英文真实year→month→week、刷新、再键盘切today通过；组选项身份与焦点稳定，桌面布局及中文下半页人工截图复核正常。真实请求快，未单独取得loading/error帧；不能把代码/类型检查称为这些状态视觉通过。

最终Bun1.4.0运行`packages/opencorvus/script/run-tests.ts test/usage/usage-stats.test.ts test/usage/stream-ledger.test.ts`：32测试/242断言、0失败、实际exit0。Havana补充基线30项24通过/6失败与原7失败均保留。后端typecheck、Overlay typecheck、check:i18n（两语言2156键）及Node私有Vite build通过。新生产getPossibleOffsets类型检查已实际重跑，不沿用中间结果。

独立18574生产writer/DB/真实HTTP链以明确人工统计事件验证2026年Santiago桶：200、3调用、600Token、$0.006、三个准确自然日桶。视觉18573使用另一全新空真实账本，未展示人工财务历史。没有真实模型、官方管理密钥、系统时间修改或测试时钟接口。所有自有页面关闭后生产stop实际完成，三scope原exec均exit0，物理PID与端口已复核；见[完整证据](../../artifacts/2026-10-13-usage-time-boundaries/README.md)。

当前06-provider与07-panel合同、双语未发布日志、根/月/artifact索引同步更新。不更新版本或发布。最终Prettier三产品/测试文件及范围git diff --check通过；`bun run docs:check`实际exit0（345操作/25组）。提交前只stage本批六个实现/测试/公开文档文件、单一新spec/证据目录与三个索引的本批精确条目，保留其他任务file-alias/PDF/recovery索引及产品改动。之后按fresh fetch→merge origin/main→完整待推提交集合审核→正常hook与push交付，实际提交/push回执由本轮交付消息和下一批Recall记录；不在commit内容中伪造尚未执行的push。持续目标保持active。
