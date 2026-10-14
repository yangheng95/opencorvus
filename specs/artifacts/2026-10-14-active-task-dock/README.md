# 活动 Task 指导与侧栏实页证据

对应[方案与完整结果](../../records/2026-10/2026-10-14-active-task-dock.md)。本轮使用两个真实 Task、41 条真实 Sol 流、自有 /ui 页面与11张原截图人工复核；没有UI自动化测试。

- 01—05：首Task真实生成中关闭/重开、正文从第3节继续到第8—9节、向上读原来源。07实际打开README并定位2—3行。单次流中恢复通过，不等于所有闪烁/多成员场景通过。
- 06：修前成员完成后才有指导入口，实际提交又落在Task终态，仅acknowledge_terminal；所要求的短摘要未在此Task执行。
- 08：修后成员活动时可直接填写指导。09虽文件名含accepted，内容实际为超时诊断，不能当成功回执。10在真实新增摘要旁保留首次“signal timed out”及输入。11通过相同请求身份重试取得原回执，不能当首次及时受理通过。
- [持久事实核验](persisted-check.json)：唯一art_1c71e9b10c80478ebf95→真实redispatch response/action→原child新输入→同成员三句摘要，完整action outcome；原Task15条消息及Part/Tool/outcome/Artifact保持，原Source对应真实read。
- [运行摘要](execution-summary.json)：live18、after23条Sol200/eof；两个原handle均join0，公开shutdown、物理/output/request及配对退休在live/after。原数据仍保留。
- facts保存原只读SQLite及正式CLI请求/接受；execution保存实际输入脚本、原构建/type日志与复用的Native包装器。previous-413保留上轮两次远端并发拒绝及最终正常up-to-date原件。

未完成：首次指导受理仍与实际编排执行同步等待耦合，下一批继续共享机制审计/修复。两成员切换未操作。本轮交付ChatBubble活动指导入口，未修改后端或提高前端超时。
