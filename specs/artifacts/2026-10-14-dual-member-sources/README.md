# 双成员来源与切换证据

对应[实施前方案与结果](../../records/2026-10/2026-10-14-dual-member-sources.md)。真实Task tsk_g00VY03x7l00hBFRdf8z自然产生两位同名base-researcher，旧UI名称/状态重复；新UI以实际Session后缀qpRU/0sM0一致消歧。没有UI自动化测试。

- [旧下拉重复](05-identical-completed-options.jpg)、[旧列表重复](07-identical-agent-list.jpg)。
- [新下拉与进度卡](12-distinct-options.jpg)、[新列表](14-distinct-member-list.jpg)。
- [交付来源第3行](13-after-delivery-line3.jpg)、[价格来源第2行](21-after-price-line2.jpg)。
- [价格阅读位置](17-price-midpoint.jpg)与[返回后](19-price-midpoint-restored.jpg)；[交付阅读位置](18-delivery-midpoint.jpg)与[返回后](20-delivery-midpoint-restored.jpg)。原图共21张，均人工查看；11未显示标题，不作标题证据。
- [实际SQLite检查](persisted-check.json)：原Task 13消息/38Part/8工具/10artifact和415的17消息/48Part/14工具/15artifact内容保留，来源Part分别绑定两个真实Session与独立read。
- [执行汇总](execution-summary.json)：before真实Task13条Sol，after历史读取预检2条Sol；均流式/200/eof，Native原handle都join exit0，物理收尾及复制凭据配对退休。
- live/、after/保留预检、原生进程、真实Provider请求审计、公开shutdown与配对退休；facts/为只读事实压缩；execution/为执行源码、原始构建/类型/失败日志与checker。

边界：后验是同一已完成Task历史阅读，不是新双成员同时流中运行。页面37曾变为0×0并发生CDP超时，新自有页38恢复；位置资格在38重新建立，临时viewport和visibility已恢复。SQLite诊断reader并发打开曾遇恢复锁；保留失败日志，使用与产品同值的busy_timeout后顺序原检查通过。完整解释见对应记录。
