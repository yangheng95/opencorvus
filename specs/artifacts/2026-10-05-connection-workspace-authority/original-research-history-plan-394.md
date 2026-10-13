# 394 原始Research Studio长历史Sources

## Recall

用户要求持续自主体验/修复，明确Sources显示为主要问题，并报告成员侧栏Rendering闪烁；最新人工指令只允许单agent开发，旧goal的并行文字不执行。上一轮393为progress：7f11e61908bce4556c33f591a249034157e0eb13已正常推送main；39项不同backend检查通过。首次push被其他正在修改的compaction类型错误挡住，第二次被其新covered_parts/错误schema尚未生成OpenAPI挡住；没有修改/覆盖其文件或绕过hook。对方实际修复并生成后，api:routes-check通过，fresh fetch/merge/完整3提交集合复核后，原10738实际exit0推送3c5adc5bf..7f11e619。精确提交module1154/5912/4和release5项通过。所有393 checker句柄闭合；没有UI/外部模型新增调用。

393结束前只读原始C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db，定位到与截图路径相符的research-studio-researcher Session ses_hbLhVnvjgyxCro475ne2，父ses_-zUSdLF94zzJawyj4Zuy，Project prj_h5qbWiFVHxI6qXpzkg8E。实际711 assistant/8 user Message，209 source-url Part、40 text Part。Planner和Analyst也在同父下。计数只是数据库事实，尚未成为当前UI或原闪烁的验收。原始数据库、项目与用户进程未改动。

已读393 Recall、349真实37段/36Sources长会话验收及限制、388参考历史重连身份修复；当前SourceParts/CardParts检索、SessionKind/storage compatibility、相关历史UI范围。349已经覆盖缓存32份边界、实时旧阅读点及后续负责人输出，但明确没有原Research Studio旧数据资格；388证明同ID参考历史包装重建，不能据此认定原209来源已稳定。SourceParts当前按type/session/message/sourceId保持身份，URL标题/路径/域名与实际目标分开；原记录有模型来源和工具来源混合，部分source-url没有toolPartID是待核验事实，不能凭此删除来源。

## 调查深度和影响面

可观察原问题是每个工具下面重复Sources 1、长URL/行间留白和Rendering反复替换内容。当前真实源数据规模已知，旧布局和渲染路径先前有多批修复，但原数据当前装载、分页、Source与Tool关联、持久身份和会话切换尚未知。直接触发/根因必须由现在的真实页面、规范接口与数据建立，不能把截图年代或数量直接当根因。

本轮先无生产修改。范围包括Main/Subagent/Side共享SourceParts、消息/活动投影、历史分页和稳定Key、Markdown异步渲染与滚动阅读点。无模型或工具执行需求；先验证历史数据读取。若触发调度/恢复/队列/终态异常立即审计其共享生产入口、Task/Mission/Session轮次、正常/终态、重试重启、串并行和多项目，不能启动复制库后把它意外恢复的任务当视觉验收。

原库含所有用户Project与执行事实。必须先核对可用只读展示面或安全隔离恢复路径：不得直接把原数据库交给当前写入/恢复服务，不重启用户窗口/进程，不改原消息、来源、目录身份或终态来凑当前schema。若采用一致性快照，原始内容保留在私有隔离runtime，先验证当前数据库公开契约和可用恢复机制，再启动真实开发/ui；不能创建假Task、临时UI数据适配层、兼容renderer或把fixture-only页面称端到端。数据形态不兼容或服务面不可用则保留精确阻塞，继续可安全完成的调查。

## 实施与验收顺序

1. 只读核对原Task/Session/Project关系、Source与真实Tool绑定、原DB现行契约和用户已有服务端口。优先自己的隔离页面，只用读操作；没有授权去关闭/刷新/重启用户已有页面或进程。
2. 根据实际可用服务/隔离方式补写具体生命周期方案，再启动真实/ui；需要新服务则固定启动、存活、活动和退出边界，原句柄/输出/端口完整闭合。此阶段不复制凭据、不执行模型、不恢复原研究任务。
3. 人工查看原209来源在真实页面的分页、工具关联、长URL密度、展开/复制/目标导航、关闭重开/刷新后的阅读位置。保存目标区域截图，逐张人工复核；不新增或运行UI自动化、DOM/快照断言。单次加载占位不等同持续Rendering闪烁，静态旧历史也不能证明流式稳定。
4. 若复现，先补完整共享根因和影响分析，复用现有primitive修唯一当前路径，再按同一真实数据/动作复核。后台修改有聚焦正向合同。同步根/月/artifact索引、docs/architecture和必要类型/构建，归档393最终push与本轮证据，范围提交及正常推送；整体goal继续active。

## 私有快照及正式准入结果

按[Bun官方SQLite文档](https://bun.sh/docs/runtime/sqlite)在readonly事务中调用底层sqlite3_serialize，完整数据库仅保留在私有runtime；原研究员719 Message和2062 Part逐identity/完整JSON与恢复件相等，SQLite integrity_check=ok。第一probe误给普通runtime设置OPENCORVUS_TEST_HOME，被现有测试隔离校验拒绝；这不是产品失败。移除此错误测试设置后，对同一私有副本调用正式Database.Client，返回SCHEMA_RESET_REQUIRED，首个差异是多余engine_dispatch_lineage_initial_workflow_node_idx，尚未创建listener/Project执行/恢复/模型。

只读规范schema审计：原Session和全部Message/Part均通过当前公开schema；719消息、2062非Tool Part、708真实Tool requests；209网页来源共200不同URL，146次webfetch和11次websearch，Provider为opencorvus-webfetch/open-websearch，原来源均未绑定toolPartID。现有历史来源允许未绑定；不能补写猜测的Tool关系。仅以parent Session查engine_task结果为空，不等于没有Task，须继续沿真实创建/派发事实定位。

已发现现成Session.importSnapshot/CLI import和mysql-transfer全图导入。下一步只比较原库与当前正式transfer的完整表/列合同，核验可否用现有导入能力完整保存数据；不先改库DDL、不伪标旧库为当前epoch、不删除记录/补造authority。新或缺失事实须逐项报告。正式导入尚未执行，UI资格仍未达成。

表/列对照发现，当前transfer的83张逻辑表在原库全部存在且列集合一致；额外仅database_authority及SQLite全文检索派生表。mysql-transfer明确不导入本地database_authority，目标数据库建立自己的存储实例身份；memory_fts也按现行工具重建。因而可以进一步只做正式导入preflight：读取83表原值，按当前公开transfer格式构造“拟导入包”，目标schema标识来自当前工具正式声明，原物理schema拒绝事实独立保留，绝不宣称原库已是当前epoch。仅使用官方preflight的完整行、关系和触发器校验，不应用导入或按失败改值。若任一历史authority不满足当前契约，保留具体拒绝并停止导入；不能用删除数据/合成新Task克服拒绝。这是私有备份恢复可行性检查，不是当前UI资格。

## 正式transfer恢复顺序的新增调查与修复方案

279407行原值进入正式preflight，在插入part时被task_root_source_part_no_insert拒绝：accepted Task-root input bundle is immutable。WorkerTurnDescriptor也给出原Task tsk_g00VXMejke00KwIb9xRv，与截图对应。已读全部transfer预检/应用/事务恢复/触发器重新启用代码，以及当前DDL的Root ingress、Part-Tool绑定、wait登记/结算、Protocol与Artifact依赖；搜索唯一生产调用和既有global request、Mission creation、panel recovery、Source结果恢复测试。仅旧数据失败不能证明当前导入器有缺陷，先用当前正式Task创建和operator message writer、实际ReadTool结果生成新快照复现。

代码依据：restorePreparedRows被preflight和apply共同调用，当前仅把protocol_event、engine_artifact和engine_task_creation_contract延后。按表顺序先恢复engine_task_root_ingress再恢复其Part会触发正确的不可变保护；当前带toolPartID的Source先于tool_part_request/outcome也会被正确的来源绑定保护拒绝。wait registration/settlement还要求真实Tool creator、activation lease与ingress先存在，不能只单独延后ingress后遗留wait路径。现有测试覆盖initial source=task和普通Session，但没有operator source=message与带Tool绑定Source的完整当前快照。

拟修复唯一恢复顺序：先恢复普通依赖行（含Message、Tool request/outcome和activation lease），再Part，再Root ingress，再wait registration/settlement，然后沿既有顺序Protocol、Artifact、Task creation contract。保留全部现有预检、foreign key/Project/creator/任务与自动化authority验证及trigger恢复；不增加禁用trigger、不修改旧库准入、不补造原字段。全仓已有调用共用该writer，无第二份恢复实现。若新快照证明还存在其他依赖，先补影响分析，不按一次报错不断扩大drop-trigger白名单。

聚焦正向检查将验证导出→正式预检→应用→重开后原输入全文、Sources→Tool实际结果及消息身份保持，补wait依赖和多Project范围；错误输入应返回明确MysqlTransferValidationError。只验证数据导入合同，不称Task/Mission全部执行/重启或UI端到端。完成后再原样重跑原历史preflight，保留每次拒绝；只有事实被当前正式导入接纳后才考虑独立/UI生命周期方案。

## 用户变更范围

2026-10-14 用户要求删除所有 MySQL 转换逻辑，停止以上导入器修复方案。两个当前输入/Source绑定用例在局部排序修复后通过；原279407行再预检仍返回 tool_part_progress: request is no longer running，原历史未取得当前 UI 资格。未执行导入或启动复制库服务；后续按[删除记录](../../records/2026-10/2026-10-14-remove-mysql-transfer.md)移除实现、刚建的专用测试与公开合同。原209 Sources 显示及闪烁仍有待真实页面验收。
