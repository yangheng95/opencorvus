# 第27批：公共URL编辑器的保存校验

## Recall

- 用户持续迭代直到明确停止，Root独立调查、实施和验收，无子agent、不发其他聊天。B26 9ad499424 normal commit/push0，所有原hooks通过，fresh远端main和own祖先确认；本任务源/两locale键/spec/artifact已清。保留其他Task/compaction及文档工作。B26真实16原图、7部分GET选择、两个运行/配对/隐私0不替代本批。
- 新线索：ChannelsPanel公共URL字段声明type=url、pattern，并在blur写customValidity，但handleSavePublicUrl由type=button直接调用updateConfig，未读原字段ValidityState。需真实页面Save与正式配置读回确认，不能先当已复现。
- 已读ChannelsPanel全部public URL/编辑scope/Save owner/配置同步/notice/timer/render，TextField Root/Input/ErrorMessage唯一primitive与原可访问关联；config updateConfig/mergePatchDiff/ConfigRoutes及Server.publicUrl string契约；channel/attachment publicUrl完整优先序和create返回链接消费；07-panel/07-panel-reactivity配置/通道/表单合同。全仓server.publicUrl/OPENCORVUS_PUBLIC_URL/public_url_invalid/handleSavePublicUrl定义、调用、schema与测试/历史搜索：唯一产品UI写入口是此编辑器；配置/环境仍为原可选字符串声明，attachment优先原显式环境再原config，再既有server URL推导。原签名/文件发布测试是非UI合同，不因本批运行或删除。

## 根因与影响分析（实施前）

1. 现象候选：socks5等不满足HTTP(S)说明/原HTML pattern的输入，点击Save仍可能出现Saved并入配置；格式缺host同样要核对。即使blur设置了customValidity，type=button不会提交HTML form，不会自动进行约束检查。
2. 直接控制流：onBlur只是设置浏览器字段错误；保存函数先捕获config owner，然后读localPublicUrl/直接mutate，不会读取输入原ValidityState。TextField.Input是真实原生input且ref/validity原样透传，共享primitive没有额外save gate；根因是这个编辑器没有执行已声明的HTML约束。仅禁用外观按钮或另写一份URL正则都不足。
3. 公共契约边界：本批针对产品编辑器的既有HTTP(S)承诺。Config.Server.publicUrl、直接API与显式环境仍是当前可选字符串合同；不擅自加schema refine、数据格式/迁移、改SDK或重写已有配置。该低层直接输入并不因UI通过被宣布已校验，旧坏值不自动猜测/迁移；用户可用此现有编辑器纠正/清空。附件发布/签名/回调和外部通道发送不在本批业务资格，也不修改原优先级/文件数据流。
4. 最小修复（真实复现后）：公共URL字段持有原Input ref，复用原生type=url+唯一HTTP(S) pattern的checkValidity；handleSave在捕获owner/更新配置之前调用同一私有字段验证。blur也用它，删除旧并行正则/customValidity。当前验证结果作为已有TextField invalid/ErrorMessage投影，错误由现有语言键在render翻译；新输入/接受配置同步清当前字段错误。失败聚焦同一字段，保留草稿；空值允许原清除语义。HTTP scheme不区分大小写，pattern沿此原语义支持大小写，不能让新校验误拒原blur正则允许的HTTP/HTTPS。
5. 反馈/生命周期：复用TextField的aria-invalid/errorID与原当前语言key，更新其摘要为有效HTTP(S)地址；不靠浏览器外层气泡截图或DOM替代视觉。编辑/拒绝保存只清catalog槽的过期notice，不删除其他channel编辑槽的错误；原ChannelSaveOwner、配置已提交事实、scope/代际/timer/finally与教程owner保持。没有LLM流程gate、备用校验或新配置事实源。
6. UI-only改动，不新建或运行UI/源码文案/DOM/渲染/快照/像素测试。正式HTTP checker只读真实config的server.publicUrl/status/原body长度安全选择，明确非完整配置正文。修前用原公开保存读回非法输入；修后先保存合法本机base，非法输入后GET正向确认原合法值保持，随后合法大小写URI/路径纠正与空值清除均准确落盘。
7. Root真实桌面：before18682/83用B26冻结UI，after18684/85新Node bundle，经开发backend /ui，无单独Vite。完整公开models+生成假auth同对；不设置任何通道凭据/enable、不发送外部消息、不触发模型。中英文实际操作非HTTP协议、缺host、有效HTTP(S)/大小写scheme、路径、空值清除和重开回填；错误原图必须覆盖当前字段/inline message，人工查看后再确认。只声明本机URL，不冒公网访问/附件可达。
8. 影响横审包括当前目录/API authority、public URL与channel编辑并存槽、保存busy/正常/error/终态回收、配置重载与关闭重开。没有后台调度/队列异常；若发现则按全仓生产入口、Task/Mission/Session occurrence、重启重试/串并行/多Project审计，不能降为偶发。用户名/密码/真实通道/直接API坏输入拒绝均不在本批资格。
9. 先本spec/三索引与修前原件，再按证据改动。overlay类型、Node build、当前i18n/docs/架构及正常hooks；只own页面/服务，normal marker/settlement→父exit/双端口0→假auth/models整对清理→完整日志隐私。所有失败保留、工具先修重跑；架构与中英未发布日志、原图/安全GET/运行/前批交付回执同步。范围commit/fresh fetch+merge/完整pending审阅/normal push后继续；不新branch/worktree或发布。

## 实施前状态

仅分析与方案，产品尚未修改；真实非法保存与校验资格待运行。

## 实施前真实确认

before PID10824、18682/83，occurrence3515e1f9-265f-4f7e-912d-4dd4d52d7341。真实基线GET200/publicUrl:null；Root输入socks5://127.0.0.1:18683并实际Save，01原图显示Saved；正式GET200精确读回该原字符串，切Network再重开Channel，02仍回填同值。不是只有浏览器内存或最后按钮状态的推断，确认编辑器没有检查原HTML约束。tab35已关闭，正常own settlement已请求；未启用任何channel/凭据或发外部消息。按原生字段校验/行内反馈方案实施，原直接配置string契约不变。

## 行内反馈的补充影响（追加实施前）

首after PID86832、18684/85，occurrence43821b09-3e2c-4ef7-b794-31f35f65b3ac。已真实保存合法/original（03），非法socks5 Save后行内错误/原草稿（04）正确，正式GET仍精确原合法值；三个GET安全选择均200。类型0、i18n2/2301、初Node build1m14s0，不代表最终UI。

继续输入缺host时，旧exact textbox名称定位实际no_matches/deadline，动作未完成。原AX仍显示Public Base URL；实际DOM snapshot则为“Public Base URL Enter a valid public URL starting with http:// or https://.”，说明原HTML label包含新ErrorMessage，名字随错误挂载改变；这不是字段消失或配置失败的结论。TextField.Input完整透传aria-label，ErrorMessage已有独立aria-describedby/errormessage关联。追加只为此当前输入绑定同一t(channel.public_url)作为稳定名称，保留可见Label和原错误关联；不改全局primitive或复制一份名称来源。然后新Node ui-after02、fresh after02 occurrence重跑完整页面/读取矩阵；首after原图/GET与这次定位观测均保留，不当最终资格。Source/接口/owner方案其余不变。


## 最终真实资格与清空缺口

after02 PID8136、18684/85、occurrence32668161-c272-4a07-9bbc-4196e5248c31，最终稳定可访问名称的Node bundle56.45s0、overlay类型0。Root实际05合法/original保存；06非法socks5、07缺host均行内错误且原合法配置精确保留；08同一错误切中文即时翻译且草稿保留；09大写HTTP /review、10混合大小写HTTPS /secure保存；11切网络后重开原值。10原图在上下文恢复后通过本地view_image实际查看，未假定截断的工具输出已完成复核。HTTPS仅地址声明，不是TLS连接资格。

12清空Save虽显示已保存，13稳定页面仍显示原/secure；正式GET却为publicUrl:null（精确原字符串已删除）。因此本批清空的持久化合同通过，当前页面同步未通过；不把Saved/GET/类型当视觉成功。全部13原PNG均Root人工查看，01–04是修前/中间诊断，12–13是未修复缺口证据。共有13个HTTP200安全选择（before2、首after3、final8），仅server.publicUrl/状态/原body长度，不称保留完整config或UI PATCH正文。

后续根因线索：services/config.ts六处完整配置响应（正常、已提交错误、无diff读回）直接setAppStore("config", object)，Solid store对象写入为merge；config-load两处批量对象接收与permission-mode同语义也需横审。ChannelsPanel原effect从该共享store回填，删除键残留可解释后端null/界面旧值。尚未改共享路径；下一批先完整调用点/历史/原测试分类与落盘方案，再修唯一快照接收机制，不在字段局部补写另一份状态。当前未发布日志去掉清空视觉成功暗示。

tab35/36/37均已关闭。三个自有运行均正常settlement/父实际exit0/双端口0，才清理生成auth/models整对；完整backend日志90722/99834/129206字节，stdout/stderr均0，隐私检查0，requests/realSolCalls0。后两轮完整公开模型目录与假auth配对，无复制用户凭据、启用通道、外部消息或模型请求。直接低层配置string、附件签名/可达性、真实Provider/Sol与其他Project/Task操作不在资格。

本批范围为输入校验和稳定本地化字段名，清空后的共享快照投影尚未达成，单独如实保留后续调查；不是全部Channel流程完成。当前架构、三索引/未发布中英日志和原证据同步，最终检查/范围commit/正常push以原回执为准。
