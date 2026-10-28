# 待发送附件与项目重开生命周期

## Recall

用户要求单代理持续自主产品体验/修复、真实页面截图人工复核、聚焦正向功能验收和范围提交后正常fetch/merge/push，直到明确停止。禁止委托、重查已解决Rendering、创建分支/worktree、重启用户18571或窗口；只在真正无法安全判定的冲突时等待。上一轮是progress：`e0b4cb3d7d26e20f4cccf12d101c721db57d0b47`已推送，12:59:38Z fresh sync0/0，自有源干净，176其他工作区状态保留；统一规范URI的SVG图库/消息/输入区全图，15实页原图及4项20正向断言通过。整体Goal保持active，旧目标中的Astra授权已被后来“只用一个agent”覆盖。

已重读767 Recall/剩余项、07-panel关于只读附件核对与volatile attachment cleanup/保留scope文本草稿的合同、AttachmentStore的原件/metadata/collectReferencedShas/sweep、Instance项目初始化、ChatComposer、composer-draft、messageStore、conversation-session/workspace/connection-settings的附件清理入口。全仓检索chatAttachments/setChatAttachments、附件draft/retain、GC_MIN_AGE与全部sweep调用。767两scope已正常退出/三项结算与精确出生身份退休，目录/认证副本退休，不延长或重开其原occurrence。

767发现的是两份旧未发送PDF/JPEG的namespace**准备拷贝**消失，原物理源及本次持久SVG保持；没有直接删除日志，不能称为用户数据丢失。768准备阶段只读复制实验已证：当前Node/Windows fs.cpSync生成PDF副本与源mtime均1793188524529.1355，而复制时刻1793192535937，字节完全相等。因此副本不是“刚产生的新上传”，已满足现60秒GC（Garbage Collection，垃圾回收）年龄条件。具体删除路径仍须实际日志确认，不以推测作为修复根据。

## 现象、控制流与待验证问题

AttachmentStore的唯一原件为当前数据库namespace中blob+metadata；sweep保护真实持久part/tool outcome/artifact/Task等引用，并跳过60秒内文件。生产调用在每次Instance项目初始化，不只进程首启动。前端待发送附件由全局messageStore持有，文本草稿独立按scope保留；切换会话、项目或连接会明确清理volatile附件，这是当前公开合同，不能将设计中的清理直接误报为bug。Settings→返回原会话应保留当前附件；配置更新可能重建项目上下文，是否因此清理仍在页面上的待发送原件尚未知。

先复现：新独立开发/ui当前构建，从闭合767后库备份并同步该数据库的物理namespace；额外按已捕获旧源拷入原PDF与metadata，用来直接观察旧未提交副本的回收，不造消息/SQL引用。运行前使用现Log.init初始化当前自有dev.log以保留CLI初始化前的真实sweep输出，不替换sweep、不编造日志、不绕过检查器。通过真实filechooser重新选择该PDF/JPEG，记录真实上传时间；停留超过60秒、Settings返回、可逆配置变更及返回后第一次读取/下载，核对实际HTTP/原字节、完整草稿与原名。观察应包含原件首次读取，不能仅凭缓存缩略图断言服务端文件仍在。查明可观察触发、共享所有者/回收根因、旧路径未治原因及定义/调用/数据/公开契约/测试/交付风险后才修改。

如果只是旧未提交拷贝按现合同回收，则明确排除该产品故障，保留正向实际证据并继续其他真实体验，不为得到代码改动而改TTL（Time To Live，生存期）或全局关GC。若真实编辑中的附件被误回收，必须修所有者与资源生命周期，不遮蔽报错，不在Send重传作为fallback，不造消息/Task作为引用，不散落第二持久来源；涉及schema或持久格式必须遵守当前02-data版本化保留数据自动迁移合同、不可改写已交付迁移。当前没有证明需要改schema，不预先升级。

## 有限资源和验收

新768目标是待发送附件的真实生命周期，首启动前固定单批75分钟绝对原生截止，所有后续实例沿同一截止，至少5分钟物理收拢余量；每实例预定15分钟公开正常shutdown，可主动提前。端口38293/38294，自有run/bundle/IAB页，不单起Vite，不碰用户窗口/服务。基线不复制认证且Provider最大0；本批总体真实流式Sol最大6（既有累计763），仅在修改后确需发送验收时配对复制已有认证/完整模型目录并分别验证凭据、模型投影和实际请求模型。不得暗增预算或把模型未投影报为未配置认证。

UI（User Interface，用户界面）只实页交互、原图截图与人工视觉复核，不运行/编写UI自动化、DOM/组件/文案断言或浏览器fixture。非UI修复必须聚焦正向真实checker，类型/build/docs不替代实页。出现任何调度/恢复/并发/终态异常即按全局横审所有Task/Mission/Session入口/轮次与多项目，不凭单场景通过降级。

关闭需公开shutdown200、原exec/native/launcher0、物理/输出/请求三项与精确出生身份退休后才退役自有凭据/目录副本；核对schema/integrity、完整旧数据/来源、原项目文件与真实输入/下载字节。三索引同步并跑当前docs checker，范围清晰commit，fresh fetch/merge及完整待推集合审查和全部正常hooks再push；保留176其他状态，不创建PR/tag/Release。

## 已取得的实际结果与转入修复

当前普通main-DbuLicNJ，端口38293。早期生产Log.init保留真实启动回收：13:07:38.890Z `AttachmentStore.sweep` deleted2/bytesFreed158703/skippedYoung0/kept2/retries0/failures0，准确对应旧PDF111015+JPEG47688，证明当前复制场景的实际回收路径；没有改生产sweep、伪造引用或延长TTL。真实filechooser重新上传PDF/JPEG，13:08:16.523Z写入；Settings Work往返和数分钟停留后，首次打开PDF成功渲染，实际下载(2).pdf111015字节。故当前证据不能支持“设置往返后会误清理活跃附件”。成功配置更新后的保留尚待后续有认证实例验证，本批不混称已覆盖。

顺带发现真实运行控件问题：13:11:18.715Z键盘将并行度5调到4，PATCH/config在54ms内以400/ProviderModelNotFoundError结束，13:11:19.287Z记录完整UI诊断；这是无认证只读实例的预期模型配置验证错误，不是排队卡死。项目文件确实保持原terminal/$schema，菜单仍显示5，但未受控Slider停留4，焦点落到AX根，图02。原defaultValue与keyed Show、busy时禁用当前控件造成错误值/焦点问题，单独进入[运行控件保存反馈修复](2026-10-28-run-control-save-journey.md)。不因为检查器无认证去绕过后端模型校验。

观察在13:15之后中断，15:34恢复先轮询原exec84095，已以0结束；原生证据证明预定15分钟公开shutdown200已在13:22:22正常完成，native/launcher0、物理/输出/请求三项完成，精确出生身份退休，距原14:22:17.473Z绝对截止3595176ms。原177页关闭并reset临时viewport，目录副本退休，源目录字节/metadata及auth metadata保持，Provider0/累计763。没有重启、续期或重开768。下一轮只修有明确新证据的运行控件问题；原附件生命周期调查作为取证结果，不能据此宣布所有跨实例/跨项目草稿保留完成。

最终只读逐表复核：92表、102427旧行逐项相等，schema9、integrity=ok，源数据库保持。后续769的新成功保存旅程已覆盖真实5→4→3→4→5，附件上传后144395ms首次读取PDF、实际下载及自然发送两附件成功，见关联记录；这些是新发生的769证据，不回填为768已完成。768没有生产GC、TTL或数据库改动。[三张原图与原生结算](../../artifacts/2026-10-28-draft-attachment-lifecycle/README.md)随同本次UI根因修复交付。
