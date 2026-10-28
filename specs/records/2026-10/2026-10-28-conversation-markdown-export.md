# 对话 Markdown 导出与交接

## Recall

用户要求单代理持续自主体验并改进整个产品，包含UI/UX、功能补齐和修复，实际验收后范围提交、正常推送；只有真实冲突才等待。不重开已关闭Rendering闪烁，不委托、不建branch/worktree（分支/工作树）。旧Goal多Astra指令被后续单代理指令覆盖，Goal保持active。758为progress：a03ea5dd1已推送，2026-10-28T04:25:05Z fresh fetch/merge为0/0，16自有文件干净，176项外部更改保持；设置说明真实中英红绿、草稿与返回焦点通过，四原图和普通构建/类型/语言/正常hooks通过。36698/98186与native/launcher0、HTTP200及物理/输出/请求/精确身份结清，两个catalog退休、无auth复制、模型0，累计759。最新闭合自有库101272行/schema9，原输入保持。756原资源截止失败、首个剪贴板未知及最终粘贴未通过仍保留，不能混为生产导出失败。GitHub私有告警清单的既有凭据授权仍待答复，不使用该登录，不阻塞本批。

本批自主检查对话导出和资料交接，并补齐可读Markdown文件。已读当前AGENTS、07-panel下载与会话身份合同、27日conversation-download原JSON入口/冷identity修复记录、App.ChatViewTitle唯一导出及所有调用/选择代次/接口权限代际/取消/反馈、唯一ExportRoutes/getActiveProjectSession/Session.messages、SDK ExportSessionResponse、CLI JSON export、file-download/downloadBlob与artifactFilename、现文件导出正向测试、两语言目录、message-part的结构化取消分类和i18n当前locale getter。全仓搜索已有transcript→Markdown、导出路由/格式与菜单，没有现成对话Markdown实现；现artifact文档Markdown是原成果内容下载，不是完整对话格式。未发现/运行触及路径的UI自动化测试。

当前可观察入口只有Export conversation (JSON)，27日原实页及当前唯一菜单可核对；本批先用当前普通构建main-E2LfApsH读取真实原755/756工具+来源+停止+续聊会话，实际下载JSON并与原API完整结构相等，确认基线和具体交接缺口，再实现。JSON不是故障，不删除原格式；新Markdown是同一快照的可读交接格式，两个格式共用一次原公开读取和同一下载请求owner，不建立第二持久化/消息/协议。

## 修改前深度与影响分析

缺口触发是用户保存已完成或中断的对话用于阅读和交接。JSON完整保存数据，但原菜单不提供可读文档；旧功能交付目标是完整原始数据下载，未实现另一阅读格式。Server唯一GET /export/session/:sessionID在Project identity中返回原session元数据和全部原Message/Part，无limit；不能改成可见卡片拼接、页内截断、LLM重新生成、Task/Mission归档或子Session整树导出。当前没有生产数据丢失或调度/恢复/终态异常证据。

决定新增唯一conversation-export纯数据格式器，在原SDK快照上生成JSON或Markdown文件；JSON仍完整JSON.stringify快照及末尾换行，新Markdown保留消息/Part生产顺序、原作者身份、正文和错误/停止事实。每条消息正文可读，并附可展开的整条原info/parts数据；工具、来源、非正文片段及控制信息完整在原始数据中，不根据标题猜地址、不复制SourceParts私有定位算法、不删改原文。Session原元数据也保留。局部格式器验证session身份与请求目标一致、消息/Parts完整对象及真实作者/时间，不生成假消息/新终态；错误以明确格式/身份错误合同交原本地化导出失败反馈，诊断只描述字段路径，不输出快照内容。

Markdown标签使用当前界面语言，日期按当前locale及现宿主时区格式化；原作者/ID/类型/路径/模型原文保持技术身份。标题/说明需要正确转义，原消息Markdown正文逐字保留；原始JSON代码围栏应比内容中的连续反引号更长，避免工具或用户内容截断详细记录。JSON与Markdown文件名沿用实际标题/Session ID和artifactFilename，复用downloadBlob原下载，不增加导出配置面。风险为不可信unknown SDK结构、跨Session数据、作者与传输role混用、长历史/空对话/Unicode/代码围栏及下载同名；聚焦正向格式合同及真实文件分别验证，不用字串扫描源码当UI测试。

App菜单在Chat/Work提供Markdown和JSON，二者沿原exportConversation统一格式参数、apiJson、directoryScopedPath、authority/selection epoch/AbortController和忙碌/下载已开始/失败反馈。旧JSON data-ui入口身份保留，新项独立标识；不改变选中Session、域权限或反馈生命周期。Markdown、JSON是明确格式选项，不是后备/兼容层；生产API/SDK/schema/迁移/Provider/调度均不改。非UI格式器有聚焦正向输出和明确错误码测试，UI不新增/运行DOM/组件/源码文案/快照/Playwright测试。

## 真实验收与资源边界

从已关闭758-after复制完整101272行及durable资源，仍使用原755自有Project三输入，开发CLI serve /ui，新自有38273；新普通构建复验38274，不单开Vite，不碰用户18571/进程/窗口/数据库。模型上限0，不复制auth，仅完整catalog和有效{}配置，累计759保持。一个40分钟原native绝对截止贯穿各scope不重置，每次ui-ready复用已验证精确owner的6分钟公开正常关闭，至少保留5分钟最终余量；已完成可手动更早关闭。异常观察不当终态或重复启动依据，先按原handle核对。

实页由真实菜单触发保存，先核对自身新文件名在Downloads中未占用或使用实际返回的新下载路径，不覆盖用户文件。原JSON文件与原公开响应逐项相等；新Markdown实际文件与完整快照核对原消息/作者、工具/来源原结构、原停止错误和新成功正文，英文/中文标签与菜单原图人工查看。真实Chat及可取得的Work/空对话分别注明范围，不以局部夹具冒充真实运行。文件内容检查不替代实际菜单交互/下载和视觉证据。

若出现调度/队列/唤醒/恢复/并发/终态异常，立即按共享机制横审所有生产入口、Task/Mission/Session轮次、正常终态、重试重启、串并行和多项目，不先认作单场景。原exec/native/launcher0、HTTP200、物理/输出/请求和精确身份结清后才退休catalog，核对源字节/元数据与auth元数据保持；逐表全部旧行、schema9/integrity和Project输入保持，真实重命名若为区分本批下载，精确绑定原Session并记录授权字段。

完成后普通Node build、typecheck、语言/文档及相关正向检查；当前合同/证据/三索引同步，范围提交，fresh fetch/merge、完整待推集合审查和正常hooks推送。无版本、tag、Release或发布流程。整体Goal仍active。

## 当前状态

759实际38273/main-E2LfApsH、无auth/模型0读取原真实会话，菜单仅JSON，原图01已人工查看。通过原Rename把本批副本的同一Session标题改为“对话导出体验759”，避免下载同名混淆，不改来源或消息。公开GET export实际200，8条消息/23片段、真实user/chat作者，包含tool/source-file/reasoning、原停止与真实续聊。第一次只点下载后按假定Downloads路径读取未找到文件，不能当实际落盘；改用内置浏览器的原download事件及path取得实际保存文件，57622字节与原API完整结构逐项相等。该观察没有证实产品下载失败，未修改共享下载primitive。原exec13447/native/launcher0、公开200、物理/输出/请求/精确身份结清后退休catalog，余量2126365ms；页面155关闭，源保持，模型仍0。

已按原方案实现唯一conversation-export格式器，两格式共用原快照/目录/请求owner。Markdown正文/作者可读，Session和每条整原消息以可展开原始JSON保存，围栏长度按内容反引号确定；来源/工具字段不重建、不猜地址。JSON保留完整原快照及换行，文件名取导出快照实际标题/ID并走现安全命名。App菜单新增Markdown并保留原JSON标识，统一忙碌/完成/错误和取消生命周期；两语言各新增8键，07-panel同步。首批5项非UI格式合同13断言通过，追加同Session消息归属与重复ID明确错误合同后继续原checker；没有UI自动化测试，改后真实下载及视觉尚待完成。

最终7项正向格式合同15断言通过；类型检查、普通Node构建main-CZ--UKQz.js/renderer public surface、2语言2602键及351操作/26组文档检查通过。现闭合真实库还保留750的8消息Work：ses_-zUQhR9QqzzzMZkMj093、真实anonymous目录和原三轮交付历史，可验证goal-controller等实际作者；未找到现存空Work，空态仅由格式合同证明，不制造假对话作为实页证据。改后复验包含两个真实Session、语言切换与3次下载，因此在启动前将该scope提前公开关闭设为10分钟，整批原40分钟物理截止和至少5分钟余量不变，Provider上限仍0；基线6分钟计划原样保留。原文Markdown不重新生成或规范化，原始数据始终完整附带。

改后真实Chat Markdown/JSON与中文Work Markdown已实际下载，独立Markdown lexer还原全部原记录并核对可读正文，原实例39358已公开shutdown200、native/launcher0及原三项/身份结清，catalog退休，两页关闭。进一步加入121消息顺序/全量格式合同，最终8项16断言通过；不重建未改变的生产UI。文件的独立视觉阅读另以标准Marked渲染实际已下载文件，脚本只提供两个固定loopback只读文档、CSP禁止脚本/网络、自身70秒正常关闭，沿既有隔离run-with-inactivity原命令checker监督；不重新启动Project实例、数据库或凭据，不重置原实例40分钟期限，不把独立文档预览称为应用文件查看器验收。

## 最终真实验收

六张原始浏览器截图均已人工查看，见[证据入口](../../artifacts/2026-10-28-conversation-markdown-export/README.md)。真实英文 Chat 菜单触发 Markdown 58445字节及 JSON 57622字节；原8消息/23片段，2来源、4工具、1条原停止错误及后续成功正文完整，5个非空原text片段在可读正文。真实中文 Work 下载41247字节，原8消息/20片段、2工具、7个非空正文完整，原goal-controller/work作者保持，原已完成Goal没有唤醒。实际文件经独立Marked词法解析恢复整原Session及每条原info/parts并与公开原响应逐项相等，JSON完整相等；下载副本chat.en.md/work.zh.md逐字节保留于证据目录。真实空Work未取得，只声明正向格式合同覆盖。

英文、中文实际文件另以标准Marked阅读预览人工检查标题、元数据、正文和原始数据折叠。第一预览原exec20837正常0、自身70秒关闭；关闭后访问中文页出现连接拒绝，确认原命令已终结后，独立中文预览原exec11798正常0，05:14:43.961Z启动、05:15:53.966Z关闭，实际截图06完成。此处没有应用进程/数据库/模型，不能混为原实例延期、产品故障或应用文件查看器通过。实页155/156/157、成功预览158/160已关闭；159错误页因浏览器对data:绑定策略阻止关闭操作，不绕过，留正常回合清理，无活跃服务。

基线源101272旧行保持，副本101271原样、一条同Session授权重命名仅title/time_updated，最终101304；改后源101304及副本全部旧行原样，最终101306。两库schema9、integrity ok，原三个Project输入逐字节保持。基线/改后原exec13447/39358、native和launcher全部0，公开关闭200；物理完成、输出排空、请求清理及精确出生身份退休具备原证据，75/100命令原句柄均fulfilled。原40分钟绝对截止前余量2126365/863052ms，提前关闭timer随正常关闭dispose，未声称自动timer触发。两个catalog副本已退休，无auth复制，源catalog字节/元数据及auth元数据保持，Provider0/累计759。

8项非UI正向格式合同16断言、普通Node构建main-CZ--UKQz.js及renderer public surface、类型、两语言2602键、351操作/26组文档检查通过。没有UI自动化测试、API/SDK/schema/迁移/版本改动。接着按当前分支范围提交、fresh fetch/merge、完整待推集合复核和正常hooks推送；结果以实际Git输出为准。整体Goal继续active。
