# Side Chat 连续操作实页证据

对应[调查和验收记录](../../records/2026-11/2026-11-01-side-chat-request-ownership.md)。单 agent、完整开发服务 `/ui`、本人隐藏浏览器页113/114；未操作用户18571窗口。14张截图均真实保存并人工查看，没有UI自动化、生成截图或像素断言。

- 01–04：基线实际双击同一主 `/side`，正式创建2个Side，两份问题相同。
- 05：修复后相同实际双击，正式Side1、原问题可编辑，主稿确认后消费。
- 06–07：英文真实存储500，主稿保留；恢复存储后由主输入明确重试，Side2接稿。
- 08是中文提交前的真实画面。第一次误点了变化后的AX（Accessibility，可访问性）索引对应的splitter，没有触发创建；已按真实时序命名保留，不包装为失败截图。09才是从当前Send控件实际触发的中文500。
- 10：中文Side Retry交接原问题至Side3，后来写的独立主稿保留。
- 11–12：新稿实际双击只创建Side4；空 `/side` 双击打开既有Side4，原问题保持。
- 13–14：明确加号新建Side5仍正常；实际重载、header打开后选回Side4，独立主稿及其Side问题均保持。

[formal-side-facts.json](formal-side-facts.json)来自各节点正式API（Application Programming Interface，应用接口）读取：before为2，after为1/1/2/2/3/4/4/5。源与所有本人新Side的消息均空，问题是未发送的客户端草稿，未伪造参与者消息。

[request-arrivals.json](request-arrivals.json)来自原服务器实际POST到达日志，before2、after9。after是5次真正创建和4次真实存储拒绝。两组快速失败的第一笔500均早于第二次点击到达：英文25.899→25.934、中文56.247→56.289；因此如实保留2次明确点击产生的失败尝试，不宣称错误场景每次双击只有1个请求，也没有在成功路径引入延迟。[storage-errors.json](storage-errors.json)记录原HTTP500、requestID及SQLite触发器错误消息。

[verification.json](verification.json)汇总17项纯数据正向测试20断言、类型/i18n（Internationalization，国际化）/普通前端构建0，以及两个实例全部旧行、schema9/92表及全部非内部结构对象、217附件、旧82/83项目和Git、9Goal完整公开事实保持。模型请求0、累计1193；两实例均public shutdown200、原native/launcher0、物理/输出/请求结清，两组认证及完整模型目录共4个副本退休。未执行新的远端模型或Side Stop，不能将预检投影说成远端推理验收。
