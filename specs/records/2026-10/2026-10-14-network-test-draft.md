# 第25批：代理测试的编辑草稿所有权

## Recall

- 持续迭代直到用户明确停止；Root独立调查、实现和验收，无子agent，不给其他聊天发消息。B24正常范围提交5449398be、117路径/一个产品源，Root normal push0，全部原工作区hooks通过，fresh fetch/原远端main与own祖先确认5449398be；自己的源/spec/artifact已无未提交改动。其他Git/compaction/ChatBubble与specs变更全部保留。
- 新线索来自NetworkPanel源码阅读：Test在途时表单字段仍可编辑，onInput和两个switch只clearFeedback；ownsUnchangedConfig只看已持久配置更新的configGeneration，未记录这些编辑。本批不把这一线索提前当已复现故障。
- 已读NetworkPanel完整字段、createEffect、三个action/捕获/所有权/结果与finally/清理/timer；唯一overlay testNetworkProxy/config读取/写入，公共config proxy/test路由与输入schema，真实util/network-proxy-test及唯一proxy transport选择；07-panel Network/Feedback合同与07-panel-reactivity applied authority；B24 Recall和原push；10-05 workspace authority历史、10-13 proxy credentials方案。全仓检索testNetworkProxy、NetworkOperationOwner/captureOwner/ownsUnchangedConfig/configGeneration/clearFeedback与proxy测试，唯一UI调用为本组件。模型/工具/浏览器网络各scope仍由原NetworkProxyTransportOwner拥有，本批不改。

## 根因与影响分析（实施前）

1. 可观察候选：代理A开始测试后把URL改成B，A的稍后错误/成功仍落在B下；切用户名、密码或两用途switch同理。旧Feedback已被编辑清空，却可能被相同仍存活HTTP回调重新写回。需要真实页面和本地TCP（Transmission Control Protocol，传输控制协议）代理原请求/响应证据确认，不能仅以代码或最后红色提示判根因。
2. 数据/控制流：captureOwner绑定API authority、Project选择epoch/Task/目录、operationGeneration和configGeneration。clearFeedback只清UI值，不改变任何owner；createEffect仅在实际配置同步时递增configGeneration。draft编辑不是持久配置更新，因此旧result/catch仍通过ownsUnchangedConfig；原finally使用ownsScope，已能在真实请求结算后恢复按钮。直接递增operationGeneration会让旧finally失去所有权而将busy留住，不能这样补。
3. 共享影响横审：所有生产入口仅NetworkPanel save/delete/test；字段编辑、global/project配置同步、当前Task/Chat/Work/Mission选择与API切换、关闭重开、正常/错误/terminal finally及feedback timer均已按同一owner梳理。Test与save/delete按钮互斥，UI不存在另一次Test覆盖在途Test的合法入口；原字段可编辑。不是后台任务调度/队列/唤醒/恢复异常；若真实运行发现该类异常则扩大至全部Task/Mission/Session occurrence、串并行、多Project、重试重启，不以局部通过排除。
4. 旧路径未根治：10-05 scope/authority解决换服务/换目录迟到结果，10-13代理凭据保留真实空白；两者不代表未保存草稿的新旧所有权。Provider已有独立表单/test owner，不能复制整套状态机或扩大到无证据重构。Save/Delete提交的持久配置及post-commit反馈沿其原合同，未证明有本批测试响应问题；不改其写入/回放/补偿，表单在途写入同步的更广语义仍待独立证据。
5. 拟定最小实现（真实复现后）：复用当前configGeneration这一个既有投影代际，明确为draftGeneration；现有配置同步和clearFeedback均推进它，使字段编辑与新操作清空反馈都退休旧Test结果/catch。NetworkOperationOwner和私有ownsUnchangedConfig相应改为draftGeneration/ownsCurrentDraft。operationGeneration/ownsScope保持真实action寿命，旧Test的finally仍在真实HTTP返回时释放busy；不因编辑假装物理请求已结束，不新增取消/重试、busy信号、第二状态或请求调度。save/delete当前成功后的completionOwner仍捕获实际同步代际。
6. 公共契约/数据/交付风险：只UI内部投影身份命名/递增点；没有后端参数/返回/错误、schema/迁移、Provider、配置面、SDK、网络target/timeout或真实HTTP取消变化。原URL/用户名/密码与两个用途字段不裁剪、不写日志；每个label/错误仍沿既有语言目录，原诊断保留。需要确认编辑后按钮真实结算、可重新Test，并读回同一真实新草稿的结果，不以“不出现旧文案”负向测试当核心。
7. 真实隔离：before18670/71、after18674/75开发backend /ui，before用B24冻结UI、after新Node构建；同PID另开18672/73与18676/77两个仅loopback代理，A实际接受CONNECT后8秒返回502，B立即返回503。两者均不拨出公网、不模拟Provider成功；原请求首行/时序/HTTP状态保存，绝不保存认证header或用户凭据。开发完整公开models+生成假auth同对，不使用用户凭据、不触发推理。无独立Vite。
8. Root实际操作：英文before在途Test(A)→编辑URL为B→等待A真实返回→截图；after中英文分别覆盖URL、用户名/密码/用途切换的代表编辑组合，确认新草稿值/按钮状态、原A真实关闭；用当前B再Test，截图新正式诊断，清空/重开仍可用。后台正式HTTP checker可测试同真实A/B正向error契约（status:error、target/duration与TCP原首行），但不能冒视觉；不新增、运行UI或源码文案/DOM/渲染/快照/像素测试。
9. 收尾与交付：先本spec/三索引，后真实证据/产品修正。overlay类型、Node构建、当前docs/index及正常hooks；所有失败工具原件保留、修工具重跑。两个own页面关闭；正常marker→settlement→所有自有proxy server/socket关闭→父真实exit→四端口0→精确删除生成auth/models同对→完整原日志隐私复核。原图/API/TCP/检查/生命周期与B24交付回执归档，当前架构与中英未发布日志同步；范围正常commit、fresh fetch/merge、完整pending审阅和正常push，不新branch/worktree、不绕hook、不发布。后续继续下一批。

## 实施前状态

分析落盘，产品未修改；实际前后页面和网络资格尚待产生。

首正式checker遗漏项目路由的directory，原/config/proxy/test实际400 DirectoryRequiredError、外层exit1，原输入/status/body即时保留，TCP未进入。UI apiJson本来会绑定当前目录，不是产品缺陷。保留旧checker与原失败，仅给该正式请求补ready内自有Project A directory，再用formal-ready独立回执重跑原A/B检查；不改公开路由或schema以迎合错误输入。

## 实施前真实确认

before PID77252，18670/71与代理18672/73，occurrence6dd80fb7-0b65-4f1d-aa74-6f4d861bfb4b。修正原正式checker实际0：A真实CONNECT后8006ms/502，B真实CONNECT后3ms/503，两个原route HTTP200/status:error/target/诊断和TCP首行都完整保存，没有公网拨出。Root亲看01 A在途、URL已改B且testing/Save disabled；02已结算后B URL下面显示A的502/8003ms；03原B新测试真实503/5ms。code+实际TCP/界面共同确认旧draft被接受，不是目录/HTTP400问题或两个代理结果相同。tab30关闭，已请求正常own settlement；未保存代理或模型请求。按现有代际复用方案实施。

修后视觉矩阵明确使用URL编辑、A→B→A往返与两用途switch；用户名/密码仅源码核对它们直接调用同一clearFeedback，不输入或捕获凭据，不宣称该两字段已独立页面验收。生产最小实现仍覆盖所有这五个编辑入口，不增加凭据日志或扩大为后端代理功能修改。

## 最终实现与实际资格

- 仅NetworkPanel一个产品文件：复用既有configGeneration并改称draftGeneration，原配置同步与clearFeedback都推进同一代际；唯一ownsCurrentDraft判断结果/catch和原反馈timer。scope/operationGeneration、busy信号、原真实HTTP及finally不变；save/delete仍使用原post-commit实际代际。没有新取消、重试、缓存、配置、后台路由、类型/错误或持久数据格式，不需要迁移。
- overlay类型实际0，Node构建58.87s实际0（原warnings保留），docs345/26和架构20当前检查0。只改UI，真实手动交互是功能/视觉验收，没有新增或运行UI/源码文案/DOM/组件/快照/像素测试。正式接口checker是实际公共路由→原transport→真实TCP，不是mock或外网成功。
- after PID69440，18674/75与代理18676/77，occurrence16659c2c-d9dc-4706-9265-488f53b8bf54。正式A/B两HTTP实际0（A502/8024ms，B503/3ms）；页面结束后再两正式HTTP实际0（A502/8005ms，B503/5ms）。before修正两正式HTTP0，首缺directory的400与原exit1保留：共7个独立正式HTTP原body，其中6个当前正向error合同/1个原工具输入错误。UI自身另9次测试操作，仅TCP/截图/完整后台日志资格，不冒逐条保留了其HTTP响应body。
- Root逐一亲看15原PNG：01–03修前在途改B→旧A502落在B→新B503；04/05最终英文B草稿保持、真实A结算后Test/Save恢复，06新B503；07/08中文A→B→A往返保持原A输入且按钮真实恢复；09新一轮未编辑A正常显示502；10首次locator点击的两个switch最终都为0，只记录观测，未计成功开启，不能用它冒开关验收；11/12实际Space将LLM1→0、Web0→1，在途与结算后真实值保持且按钮恢复；13新当前B草稿在Web开启时真实503/4ms；14页面重开上部，15新自有tab32聚焦原代理字段补拍空输入/7890占位、两个关闭用途与可用按钮。14未覆盖下面的URL，不能只靠其AX宣称该区域已视觉通过。
- 开关第一次直接locator.click后值均0，触发顺序/工具映射原因未知；读Switch/layout确认前者为Kobalte label/Input/Control，后者只hover样式，不先改共享primitive或宣称产品坏。真实Space状态1/0已分别观察，11/12才计用途资格。用户名/密码未输入，成功连公网/真实认证/保存删除/换服务或换Task/Project/在途关页面不在本批独立资格；现有scope合同源码保持，不用本页通过替代它们。
- 两轮本地TCP共15次真实CONNECT（before4、after11），每次只记录首行、port/label/时序/502或503和实际close，不保留headers；所有socket最终closed，两个server正常close，未向目标公网拨号。两轮Provider inference requests/realSolCalls都是0。没有点击Save/删除/模型发送或操作用户凭据。
- 自有tab30/31/32均关闭；两个runtime正常settlement、原父exit0、各自四端口0后精确删除生成auth/models同对；两个完整日志隐私checker0。完整后台92519/136802字节，stdout/stderr各0。原失败/旧checker和B24真实交付保留；当前架构、未发布中英日志和三索引同步。随后范围正常commit、fresh fetch/merge、完整pending审阅和正常push按真实回执结算，不预写成功。
