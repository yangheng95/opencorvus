# 持续目标真实反馈与回答草稿

对应[调查、修改前方案与未完成项](../../records/2026-11/2026-11-04-goal-feedback-handoff.md)。17张图片均来自本人隔离原生开发 `/ui/` 页面，逐张实际查看；没有UI自动化、浏览器夹具、快照或像素比较。

本轮交付修复：问题弹窗和对话内卡片共用同一待答请求的原文与选择，关闭弹窗后可继续原草稿。实际通过版本为38685的普通构建`main-B3Xi2ME_.js`。38686的`main-EzNWZF0-.js`是另一次未通过历史重建资格、已撤回其文案修改的只读候选，不能作为历史修复通过证据。

|截图|人工复核结果|
|---|---|
|[01](01-confirmed-goal-start.png)|前测真实创建表单：确认本人项目、精确模型、两阶段目标及2000000令牌/3自动轮次预算。|
|[02](02-real-first-stage.png)|真实控制器开始执行读取，当前目标和原项目/会话归属一致。|
|[03](03-real-confirmation-request.png)|自然问题请求A-03状态，第一提案已交付，整个目标保持进行中。|
|[04](04-confirmation-draft.png)|原版真实弹窗输入完整确认草稿，尚未提交。|
|[05](05-dismissed-draft.png)|按Escape后对话内同一问题为空，直接复现草稿丢失。|
|[06](06-before-complete.png)|重输后实际回复，前测Goal完成、会话空闲；顶部视口仍显示第一阶段和真实回答。|
|[07](07-before-final-file.png)|滚动后最终交付文本、完成状态与两条真实修改。该图尚未打开文件预览。|
|[08](08-before-source-final.png)|从Sources实际打开最终文件，表格4条/2未完成，只有A-03改为closed。|
|[09](09-after-goal-confirmation.png)|修复版重新确认同范围项目/模型/目标/预算并实际开始。|
|[10](10-after-shared-dialog-draft.png)|真实标签选中closed并继续，输入完整确认，两种表面同步。|
|[11](11-after-inline-draft-retained.png)|Escape关闭弹窗，对话内完整原文和选项保留。|
|[12](12-after-chinese-draft.png)|通过现有设置切换中文返回，原文/选项仍在，中文回复入口清楚；随后真实提交。|
|[13](13-after-raw-answer-history.png)|新发现：实时回答历史显示技术值closed_continue，未达到可读标签目标。|
|[14](14-after-complete-links.png)|第二次完整真实工作流完成，4条记录最终2未完成。|
|[15](15-after-final-preview.png)|键盘Enter从真实文件引用打开中文最终稿预览；来源字段和状态变化可直接核对。|
|[16](16-after-goal-details.png)|普通应用内目标详情显示完整完成依据、472109令牌与1个自动轮次，预算保持。|
|[17](17-cold-question-history-gap.png)|只读新实例冷读未恢复独立Question历史；展开真实工具仍可见原问题、选择名称/值和完整自定义原文。该图是后续问题证据，不是历史修复通过图。|

两次精确`openai/gpt-6.1-sol`工作流各13次流式请求，全部HTTP200并正常流结束。首阶段检查点各只有proposal，真实回答后才写final；同一目标各接受1个自动轮次，470051/472109令牌，最终Goal完成与Session空闲。后测的目录创建前读取返回一次精确文件不存在错误，随后自然创建并回读成功，不能称工具全成功。

真实产物：[输入CSV](actions.csv)、[前测简报](before-brief.md)、[前测提案](before-proposal.md)、[前测最终稿](before-final.md)、[后测简报](after-brief.md)、[后测提案](after-proposal.md)、[后测最终稿](after-final.md)。[qualification.json](qualification.json)包含真实工具时序、逐行交付、4与3→2统计、正式账号读取、模型/流身份、原Question持久事实、六个公共读取检查点、原数据与进程结清证据。

三个实例全部正常公共shutdown200、原进程exit0、物理/输出/请求结清、六份成对认证/模型目录副本退役。原始认证及模型目录保持。原schema10/92表；源库、旧业务内容、109→110→111个受保护项目文件/Git、269→271→273份附件/元数据保全。前后测各有一次已过期容量槽的具名正常复用，不宣称所有旧字段精确；只读final旧行精确。累计模型请求从1341到1367。

范围为当前共享InteractionCard草稿，不承诺跨刷新或所有表面退休后的持久草稿；多选、自定义禁用、跨API切换及独立SideChat/Task实际提问未本轮重新验收。已答Question冷读重建和技术值可读性仍待下一批修复；没有把候选构建成功、DOM文本或模型完成自述当成视觉通过。用户正在使用的18571窗口、进程和数据库未操作。
