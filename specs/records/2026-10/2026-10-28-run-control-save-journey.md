# 运行控件保存结果与连续键盘编辑

## Recall

用户要求持续单代理自主体验、修复、真实页面与原图人工复核、聚焦正向checker及范围commit/正常fetch-merge-push，直到明确停止。不委派，不重查已修Rendering，不创建branch/worktree，不操作用户18571/窗口；只有真实冲突无法安全判断才等待。整体Goal保持active。上一交付e0b4cb3d7已推送，图库/消息/输入区SVG统一规范原件URI。当前HEAD仍该提交、生产源无其他改动，176旧工作区条目保留。768调查取得新直接GC日志与真实UI失败证据，是progress，不能把恢复观察时已正常退出的原84095当存活或因超时重启。

已重读768 Recall/实际结果、ChatComposer运行控件完整定义/调用、composer-run-controls、config service/store、后端Config PATCH和candidate validation/committed receipt、成熟Slider/Feedback及相关样式、现07-panel；全仓检索onParallelismChange/saveRunControl/runControlBusy/parallelism/配置写入和现测试目录。接口仅ChatComposer文件内生产调用。现utility测试是非DOM数据合同，当前没有发现需保留或运行的UI自动化。旧CPU调查中的配置验证事实仍成立，不把环境中的缺认证误称凭据未投影或删除配置校验。

## 修改前完整分析

可观察：768真实滑块5→4，后台PATCH400、项目canonical文件未写，菜单5而滑块4，完成后焦点在页面根，缺少控件附近可见错误。直接触发是正常保存失败；失败本身来自只读实例未复制认证，模型目录有目标而Provider受认证过滤，这是预期环境状态，非后端新故障。根因是Slider用defaultValue后持有独立未受控值；API失败只reportError，没有恢复为appStore的实际快照。数值keyed Show还会在成功保存后重建整个控件；保存时禁用SubTrigger/Slider会破坏正在使用的焦点。旧路径只防重复请求，没有表示异步保存结果/失败与控件连续身份的合同。

公开合同与影响面：唯一保存事实仍为config service基于当前API authority、selectionEpoch、directory与ownsResponse接纳的快照；400保持旧值，409若含已提交receipt则接纳真实已提交配置，不能对所有错误写“未保存/设置未变”。后端事务/验证/错误、并行度配置面、最大值2x现值、Task/Mission/Session调度、SQL/schema9、模型与工具声明均不改。当前请求54ms终结，没有调度/队列/恢复/终态异常证据；出现此类证据仍必须共享机制横审。

技术依据：[Kobalte官方Slider文档](https://kobalte.dev/docs/core/components/slider/)说明value/onChange为受控接口、defaultValue仅初始化。已核对当前锁定0.13.11的真实UQ2TD6AR源码：拖拽结束调用onChangeEnd，键盘dirty在blur也调用；现产品另在keyUp保存，用同一提交函数去重而非另建输入算法。保留成熟组件和当前即时键盘保存语义，不新建slider、回退协议或全局焦点接管。

实施：用局部交互草稿驱动既有受控Slider，草稿不是第二已保存事实；配置快照变化与现异步保存busy结算后均同步回实际props.parallelism，不另建Promise回调协议。非数值keyed挂载维持thumb/label身份，原防重复接纳与scope/authority退休保留。忙时保持当前控件可聚焦，使用aria-busy/aria-disabled并在受控change/commit入口阻止新提交，避免native disabled夺走焦点。并行度失败在当前子菜单复用Feedback、本地化摘要与原始诊断Disclosure；下一尝试/上下文变更清退错误，原诊断记录仍可查。不同错误均呈现实际快照，不假称未提交。无人值守Checkbox本来受控，本轮保持其原实现。风险是blur/keyUp重复、成功响应引起重挂载、迟到响应跨scope、忙时连续键盘、菜单高度/详情滚动和双语名称，均需真实页面验证。

## 新验收资源和交付

769是新发现的运行控件保存问题，768已正常终结且绝对截止已过，不续期/重开。实施/build后首个改后实例启动前固定单批60分钟原生截止，各实例15分钟公开正常关闭、至少5分钟收拢余量；错误只读实例38294最大0/无认证，成功实例38295配对复制已有认证与完整目录、实际Sol流式preflight和必要真实发送，总上限6/既有累计763，不暗增预算。新独立开发/ui与IAB页，不单起Vite，不触碰用户服务。错误样本使用真实400，不mock响应；成功样本实际5→4→3及恢复、键盘连续编辑、待发送附件停留超过60秒/配置成功后首次读取，若发送则自然用户消息与真实流式模型。

纯UI源码只实际交互/截图人工查看，不编写或运行UI自动化/DOM/组件/文案测试；类型、普通build、双语和当前docs是辅助。原件/下载字节、schema/integrity、原数据和源输入、源认证/目录元数据均核对。各实例公开shutdown200、原exec/native/launcher0、三项与精确出生身份结算后才退役自有认证/目录。768调查与3张原图随同本批范围提交，更新两份记录/产物的三索引；审查完整待推提交并正常hooks/push。任何未验矩阵明确列出，不包装整体Goal完成，不发PR/tag/Release。

## 首次改后实页与布局补充

首改类型/build与2614双语键通过。新769错误实例38294使用main-BVzUox09，真实键盘5→4触发原400后，控件和值恢复5，焦点始终在同一thumb，原label/ID保持，图01；错误摘要直接可见。展开原始诊断后图02证明popup超出屏幕底部，原oc-menu与Feedback诊断没有高度约束，不能以AX可读代替视觉通过。局部composer-parallelism-menu按现Kobalte提供的available-height限制并滚动，诊断沿当前FileExplorer同类Feedback的30vh/200px限制阅读区，不修改全局Menu/Feedback或截断原文。关闭并结算该真实实例后，以同一769原截止验证新普通构建的布局和中文，端口38296；这是实际新CSS修复后的验收，不因观察超时重启旧实例。成功38295/总流式上限6仍不变。

38296/main-lAfU1X2f实页图03–06已确认真实400恢复5/焦点、完整可视诊断滚动到底部、中英文摘要与重试。继续使用真正Tab发现焦点仍在thumb，不能自然进入Details；菜单的普通命令键盘语义拦截了嵌入的富控件，之前直接定位slider.press不能证明真实键盘入口。当前锁定SubContent明确不公开onOpenAutoFocus，不使用不存在API。以其现有onFocus在**该内容根实际获得焦点**时交给自己的thumb；包裹交互内容，在其内部只对Tab停止向菜单冒泡，保留浏览器自然Tab/Shift+Tab与原Esc，不自建tabindex列表/全局键盘路由。修后需实际由主菜单键盘打开、连续编辑、Tab/Enter详情与Esc返回；再以同一原截止新构建验收38297，不重开旧occurrence。

## 最终实际结果

最终普通构建main-B1FK__YA在38297完成真正键盘入口：More获得焦点后Enter打开、方向键进入并行度、ArrowLeft触发实际400并恢复5；Tab到详情、Enter展开、Shift+Tab回同一thumb重试，Esc两次返回原More。中文重复该完整路径，图07–09。原始详情可滚动至末尾；图02是中途发现的溢出，图04–06是布局修复后的实际结果。类型检查、build及2614双语键检查退出0；最后只对新增JSX块调整缩进，没有改动已验行为。

有认证成功实例38295使用相同最终构建，运行前分别核实配对认证、完整模型目录投影与真实请求Sol。真实文件选择上传PDF111015字节和JPEG47688字节，保留完整草稿；方向键连续5→4→3→4→5，4次PATCH/config实际HTTP200（52–67ms），菜单与滑块同步且保持同一thumb身份和焦点。在3时额外读取canonical配置，实际max_executor_groups=3。最终恢复5。最后一次附件上传请求后144395ms才首次请求PDF，实际显示/下载原件字节相等，JPEG也实际打开。自然用户发送相同两附件，持久FilePart及实际回复“本次附件已收到”对应同一真实session和msg_86e06856-7d4c-4f8c-88a5-1a996732006e；全批4个gpt-6.1-sol流式请求均HTTP200和reader EOF，总计767，上限6没有变更。

4个769实例均按原16:47:11.588Z绝对截止公开shutdown200，原exec/launcher/native退出0，物理完成、输出排空与请求清理有真实结算，最小剩余1801774ms。页178–181关闭、临时viewport恢复，认证和目录副本退休，源目录字节/metadata与源auth metadata保持。源QA项目配置在所有实例物理关闭后按原始字节恢复，真实输入文件字节保持。没有重开768或延长769。

5个隔离数据库逐表复核，均92表、schema9、integrity=ok。768和769三个只读失败实例102427条旧数据完全相同；成功实例原102427中102422条完全相同，另5条更新逐字段符合真实发送契约：memory_chunk内容/token/time、memory_file time、两条当前容量租约的重新获得及EOF释放、同session更新时间；新增真实消息、记忆事实和运行记录使总数103456。源库保持，未新增迁移，生产改动限于前端4文件与07-panel合同。

证据见[原始截图、运行与数据](../../artifacts/2026-10-28-run-control-save-journey/README.md)。400是真实缺认证环境的模型验证错误，不是模拟后端；409提交回执的真实性保留依据当前配置服务合同，本批没有伪造409做UI验收。鼠标拖拽、所有后端错误类型与跨项目草稿持久化未在本批完整覆盖。只修改已证实问题，整体Goal继续保持active。当前docs检查及正常推送hooks作为交付检查，不能替代17张实页原图人工复核。
