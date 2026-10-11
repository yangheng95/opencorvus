# 295 ResizeObserver 原因调查

## Recall

用户持续要求自主修复Sources显示、子侧栏Rendering闪烁和整体完成度；最新只用单agent，仅root。294为实际进展，5e195eb18已推送、当前工作区干净：Main真实六节正文/来源及回读观察正常，6次Provider流式200/EOF，但仍有ResizeObserver delivery报告，原子侧栏/全帧未验。不能据Main正常就宣布用户原问题完成。

已读294 Recall、当前TextPart/worker、SourceParts、SubagentConversationPanel、Conversation、AutoGrowTextarea、ChatComposer、RightDock、animation-frame、AppLog及renderer-public-surface checker。全src搜索ResizeObserver所有入口：部分共享正文/卡片/Dock已异步排frame，输入框与工具栏仍在Observer回调同步测量写入。当前不知道哪个callback造成这次报告，不能因为名字相似便打补丁或吞错误。

[MDN Observation Errors](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors)说明交付发生在绘制前，依赖循环可让通知递延并报告错误，最终稳定也不能排除中间布局闪动；修复须根据实际回调的尺寸变化判断。仅作为机制解释，不替代本项目证据。

## 实施前诊断方案及边界

不改写全局ResizeObserver，不改公开renderer globals检查器，也不用浏览器注入脚本。采用临时模块化回调记录函数，围绕本次实际页面可能激活的AutoGrowTextarea、ChatComposer、Conversation、Card、RightDock与dom-utils记录原回调进入/退出时的observed target尺寸、标签/id/class和时间；不读输入内容或凭据，不更改回调调度/返回行为。bounded ring只在原window.error记录路径附加，不抑制原错误。AppLog仍为同一日志写入者。

代码改动前保管干净原文件/检查diff。诊断仅查真实页面，不生成假布局、UI fixture、断言、快照测试或截图循环。读取尺寸会影响性能，因此诊断用于归因，最终修复必须删除临时代码、正常构建另行实际复核。若全部本地回调没有同步尺寸变化，只能排除已观察范围并继续查依赖，不能声称全部根因已找到。

## 环境与真实验收

使用原294完整已闭合真实Main历史，无新Provider调用/auth移交/Task/成员。原Session ses_-zUSGSq0qzzrHOgiE42h、Project prj_hGFxt5nJEzSZOtzudQfw，原Run stream-reading-294-live-01，parent8944 actual0、原67744/58032已物理闭合与配对退役。需fresh schema/config/全恢复前沿/消息/permission/Memory与精确出生/端口检查，然后完整90表逐行等值复制；不因历史已成功跳过当前资格。

诊断新resize-review-295-history-01，正常dev/ui18250，固定900000ms，至少300000ms收尾目标。Root操作Main来源和代码阅读、输入框正常输入/清空草稿、侧栏/Dock布局改变来观察原callback，不发送新消息；每个实际语义阶段截图并读原日志。未改用户窗口/进程/DB，不为历史无模型配置误报auth丢失。来源正文不能被诊断替换。

发现调度/队列/恢复/终态异常立即共享机制横向审计；当前布局通知与后台异常不能混为一谈。定位后补现象、触发、数据/控制根因、旧路径为何未根治、所有调用/公共契约/测试/文档/风险，再改唯一实现。纯UI改动只能真实页面交互/截图验收；禁止UI自动化。正常types/build不替代视觉。

## 收尾

每个服务自己的page关闭、sole shutdown、原前台actual join、独立物理/output/request/端口/配对闭合、19业务表/生命周期全值和配置保管；全部checker结束后5自产物才按出生/限定路径归档。原预算不延期，观察超时不当作终态。最终删除所有诊断，当前架构与根/月/相关README同步，docs/architecture与公开扫描、范围提交、fetch/merge/完整pending审查、普通push；goal active。

## 诊断记录工具修正

history-01正常18250/tab41加载真实294正文，填入原请求作为未发送草稿并打开空Dock。第一次空pipeline未形成01文件、04-observer-errors为[]，不能当UI通过：成熟history启动器明确--log-level INFO，而原main通知路径为AppLog.debug，后端Log按level过滤。先修临时诊断路径为INFO记录，再在同一原服务/固定预算内正常重建并刷新自己的41页，不重启Native、不延长期限。最终恢复原debug及删除diagnostic字段/模块，生产日志策略不改变。

一次批量UI操作在树刷新后沿用旧73索引，实际聚焦正文而未打开Dock；03图已据真实结果改名body-focus。随后AX显示checkbox、网页DOM实际button，两者角色表示不同，首次Playwright checkbox定位未找到；重新读取实际DOM角色后按button正确打开。未将未发出的动作当产品故障或Dock验收，04实际截图才是Dock打开。

修正日志后取得3个真实error事件，本地已记录的Observer callback未直接改变所测target尺寸，不能直接怪AutoGrow或工具栏。当前安装virtua0.49.3的公开README亦说明其自身observer可能产生该类通知；这是线索而非此例根因证明。进一步只临时包裹实际Solid发行版的原observer callback（js/jsx两个现解析候选，原文件逐份保管），并同时读取observed target及两级祖先尺寸，避免遗漏虚拟行测量改变父容器的路径。无全局API改写、不换库、不修warn级别；最终恢复原发行文件及所有临时代码，另用正常构建复核。

## 实证归因与决定

06-virtua-observer-errors给出实际使用virtua.solid入口。后三个error前3.2ms、0.3ms、0.8ms，原createResizer callback通过ACTION_ITEM_RESIZE更新store，真实conversation-virtual-window高度依次640→421.5→1477.59375→2424.71875；宽度759.6667保持。已测本地callback没有同步目标/祖先尺寸变化。由此将本轮这三次通知归因到虚拟行实际测量更新父容器，不能扩大到所有历史通知、原子Dock或未知库。

这组尺寸变化最终收敛，实际页面正文、输入与Dock可读，没有观察到对应持续错误循环。Virtua本身公开说明此通知与其测量有关；不能仅为日志归零而延迟原同步测量、过滤错误或添加另一高度状态。暂不修改库/生产布局。下一步闪烁调查应追查真实文本owner重挂载及大规模子会话，而不是继续假设本地输入框是本例原因。

自己的41页草稿已清空并关闭；原91303 actual0，独立closure和19表/12生命周期/config保管actual0。临时7个生产文件通过精确patch恢复、诊断模块移入spec artifact、两份库发行文件在审查仅有自己两处修改后恢复原直接字节，git diff packages为空。三次诊断build实际0（52.10/48.74/49.56s），诊断types18477实际0。接下来final history-02正常构建18251只做正常页面复核，不再保存附加Observer级字段；生产日志恢复原debug，不把INFO过滤的空日志当作修复证据。

## 最终普通构建复核

types94154及build72609 actual0（49.75s），18251/tab42实际main-DjCcg_0v.js。宽草稿、打开窄Dock后的换行/正文、清空未发送草稿和Source键盘完整Tooltip均真实观察并截图。42页已关闭，原67340 actual0、Native26648/Host76828 terminal0，10:25:41.853Z收敛余791171ms。第一诊断实例10:20:32.594Z收敛余260747ms，未达到300000ms目标，但900000ms未延期。两次独立closure/19表和12生命周期全值/config保管actual0，全部相关native checker后各5自产物归档。

本轮确立已复现布局通知的测量来源，不证明原子侧栏Rendering已修复；未修改生产布局/库/日志策略。所有诊断仅作为spec artifact保留，原生产源码恢复。继续原目标，下一轮聚焦子侧栏文本owner与大规模历史，而不以清除这类通知代替用户体验修复。

docs:check与architecture-index actual0，92份公开JSON/日志/脚本/文档精确凭据扫描0匹配；诊断diff手工审查。生产源码最终diff为空，相关索引和实际证据范围提交、fetch/merge上游、完整待推送集合审核后普通push；保留第一阶段余量不足及原闪烁未验，goal active。
