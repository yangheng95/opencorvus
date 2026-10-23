# 复制完成时序与实际内容

## Recall

557继续单agent自主迭代，旧Goal中的Astra委托已被后续用户禁止多agent覆盖，不委托。556为progress：c03c9b268已正常hooks/push/fresh0/0，修复有界工具输出改宽跳文，18实图证明字符1671与手动新读位3841保持。两服务/原exec5777及40481均关闭、0模型、catalog退休、原90表169304行保持。另一次Copy Output后专用reader得到361字符，逐字是555已知停止详情，当前JSON应为51840字符；复制验收未通过。没有产品clipboard补丁，根因未知。

当前外部工作区包括171项旧video/artifact删除、Goal/App/Composer/SideChat/i18n/main/style/架构及共享索引等13个修改，全部保留且不纳入本批。使用556已发布冻结UI资产main-DapVWEPi.js，不构建或资格化外部未提交Goal改动。已读556Recall/收尾证据、当前07-panel复制合同、createClipboardCopy完整实现、ToolPayload按钮、copyText唯一writer、Browser HostTransport的clipboard.writeText分支、原JSON结果规范持久化行和英文/中文状态。相关clipboard两现有测试已检查：一个为纯Host命令传输合同，一个为纯字符串分类，均非UI自动化，不删除或冒充网页证据；本批不新增UI测试。

## 修改前分析

可观察现象是556按钮随后出现成功checkmark，但读取发生在click Promise返回后、随后AX/screenshot观察成功之前。ToolPayload onClick为void clipboard.copy()；点击返回不代表async动作完成。copy owner先pending，await唯一Host writer后才copied并改成“Copy Output · Copied”，Browser writer返回navigator.clipboard.writeText Promise。候选根因包括验收过早读取、浏览器/调试剪贴板通道或真实写入内容错误，尚不能从成功图标和旧值推断任何一项。555已知键盘/API对照后读写通过，但其复制同样没有明确把成功状态作为先行观察，因此本批必须补准时序证据，不以额外sleep掩盖未知条件。

本批只观察界面/宿主，不涉及Task/Mission/Session调度、执行轮次、schema、消息协议、模型或配置策略。复制原文expected取原tool_part_outcome.data.output，request prt_g0VYhsJQw00UlPV31v8w/message msg_hkmMhdvRpzBesxGR2RSm/Task tsk_g00VYhrJxy00qIC54qvM，51840字符，含LIVE511A_BEGIN和LIVE511B_BEGIN，所有数据源均为已隔离真实历史。原InlineToolPart会stripAnsi；该JSON本身没有ANSI，最终比较需对照实际显示及规范原值而非自行重算摘要。禁止复制缓存、第二writer、伪成功或仅按长度宣称通过。

## 实页计划与验收

fresh clipboard-completion-557，19159，从正常闭合556-after复制完整90表/全部原字段时间/canonical，验证source0模型/retirement1/native和原launcher/physical/output/request闭合。20分钟原生边界、180秒启动无活动、至少五分钟收尾；只复制完整models目录，不复制auth，Provider请求预算0。不操作用户数据库、服务、页面或窗口。

打开同一实际Task，展开原read_agent_message/Output。先不改剪贴板，以按钮点击→实际AX查看其pending/“Copy Output · Copied”状态→专用reader→真实Ctrl+V到未发送主输入框的顺序核查。只记录长度/与expected及已知旧值是否相同；未知内容不输出/保存，草稿立即清空，不点击Send。产品内容需与规范原51840字符逐字相同，Copied本身不替代内容验收。

必要对照按实际结果逐步决定：以已知短标记校准键盘copy与专用API写入，再用同一产品按钮；亦可在已知标记后对照click立即read与实际观察成功后read，明确不同完成边界。全部人工分步操作、真实截图与人工查看，无动作循环、DOM/组件/文案断言、fixture或截图基线，不调用浏览器注入的clipboard副作用，也不使用其它OS剪贴板工具绕过CUA。

若同一写入早读旧值、观察完成后读/实际粘贴均为expected，按实际证据修正验收方法，不制造产品改动；若确认产品缺陷，先补全定义/调用/旧路径/风险与唯一实现方案再修复并新服务复验。若仍无法区分，保留未知和已知旧值，不把工具限制包装成通过；继续其它可推进体验工作。

结束关闭自有页、public shutdown并join原exec/native/launcher/output/request/精确出生；catalog退休，源catalog内容mtime及源90表全部字段时间/字节mtime/canonical保持、目标原行差异与实际schema3/integrity核验。实图和非秘密证据、四索引、当前文档检查、范围提交，fresh fetch/merge/待推集合审查/正常push/fresh0/0。Goal保持active，后续继续单agent迭代。

## 实际结论与修正后的验收方法

页194先明确AX Copy Output · Copied，再专用read和真实Ctrl+V，仍得到与555已知停止详情逐字相同的361字符，故“只是读得太早”假设被排除。同页已知23字符键盘copy/paste对照后，相同产品按钮复制51840字符、实际粘贴逐字匹配原结果。页195稳定原生AX Copy Input · Copied后首次read/paste仍是旧51840字符，排除单一click API差异。此页仅真实paste后重做产品复制已得到原574字符，专用API标记读写也通过。原生首次索引在hydration中变化，03未出现Copied，明确排除资格；重新取当前索引后04才属于实际复制。

页196在任何产品复制前先调用一次专用reader（读到前一次已知574字符），随后首次Copy Output已确认Copied，read为原51840字符，实际paste逐字相同。页197在未预读条件下，稳定控件已确认Copied后首次read仍旧51840字符；仅重复产品复制、没有中间键盘输入或专用clipboard写入，第二次read变成原574字符，实际paste逐字相同。该A/B结果把本批旧值现象定位到外部浏览器剪贴板读取器的首次初始化边界；未检查其内部实现，不宣称所有历史43字符来源已证明。

修正人工验收方法：每张目标tab先初始化专用reader，不输出或保存未知内容；再实际产品动作，查看上下文Copied完成状态，读取并实际粘贴，与完整原文逐字核对，最后清空未发送草稿。不存在额外等待、剪贴板影子缓存、产品第二writer或生产补丁。当前短Input574及长Output51840实际通过，复制核验不再以未初始化reader旧值误判产品。相关两纯服务测试未运行，不能代替本次真实页面证据。

额外观察：194/195/196三个同源自有页并存时196短暂Connecting、主输入disabled；正常后端health200、精确原native进程仍live。关闭已完成194/195后196原页恢复Online/可输入，无刷新或重启；暂缺精确连接/请求因果证据，不能猜定连接配额、后端调度或模型问题。document.hasFocus在只读DOM范围不可用，未绕过工具或据此断言焦点。该连接现象作为下一批独立横向审计入口。

19159 public shutdown200，原exec28757退出0，native/launcher0，physical/output/request/精确出生完整闭合，余量586332ms；0模型、不复制auth，catalog1副本退休，原9155406bytes/mtime/内容保持。源90表169304原行全部字段时间/源文件字节mtime/canonical保持，目标原行零差异，实际schema3对象/integrity保持，provider_activity_request421→421。四张自有页均关闭、全部草稿清空未发送。期间外部Goal菜单任务b731725ad已独立提交，旧素材删除与更多索引/正文更改均保留，精确暂存本批入口，不混入交付。

[七实图及非秘密证据](../../artifacts/2026-10-24-clipboard-completion/README.md)。本批无产品/schema/API/版本改动；整体Goal继续active、仅单agent，下一批调查同源多页连接现象。
