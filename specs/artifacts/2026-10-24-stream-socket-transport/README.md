# 共享流传输人工验收

559，source CLI `http://127.0.0.1:19167/ui/`，Node正式构建`main-C7aBtTu6.js`。五个自有页205—209，全部通过内置浏览器人工交互、截图并逐张查看；没有UI自动化测试、浏览器fixture或截图断言。

- [01 第三个Task页](01-third-task-page.png)：三页同时打开，完整原正文与在线状态。
- [02 成员正文尾部](02-member-sources.png)：成员面板打开后恢复其已有阅读位置；本图没有显示Sources，不作来源视觉证明。
- [03 成员来源与正文开头](03-member-source-start.png)：实际来源标题/域名/复制操作、真实工具与已渲染长文，同源另两页仍打开。
- [04 跨项目Mission](04-mission-concurrent.png)：第四页原Mission消息和已完成旧Goal保持可读；画面里的旧控制器文字是历史原文，不是当前用户指令或本次Goal完成判断。
- [05 默认首页](05-default-home.png)：第五页输入区、中文标题和建议入口，未创建Goal。
- [06 Goal表单](06-goal-form.png)：由输入框加号→持续目标打开的原表单；随后Escape退出，未启动目标。
- [07 真实Sol回复](07-real-sol-response.png)：第五页实际选择gpt-6.1-sol并发送有限消息，原回复“多页流传输验证成功。”可见，输入恢复；模型文字本身不是验收结论。
- [08 并发Side Session](08-side-session-concurrent.png)：同一第三页追加既有Side Session，连接完成、主Task保留原进度；没有发送侧聊Prompt。

[evidence.json](evidence.json)保存实际时间、规范流身份、四次Provider读完EOF、正常原生关闭、复制auth/catalog退休及数据核对；[requests.jsonl](requests.jsonl)仅包含method/path/到达与abort时间和stream instance ID，不含正文、认证或完整query。后端新流合同10项68断言，加原历史读取/准入10项88断言，共20项156断言，不能代替上述视觉证据。

并发快照有12条尚未记录abort的规范流，其中一条直接HTTP流开始于首个测试页`/ui/`请求之前、没有ticket POST；无法证明其客户端归属，不能称作五页产生12个socket。自有页关闭后该直接流仍在，正常shutdown后全部规范流都有abort，原服务/launcher/native退出0。没有为了消除它操作其它客户端。真实POST panel消息、VCS、MCP、桌面原生窗口及服务重启重连未人工资格化；GET/POST传输、Basic Auth、Origin、ticket失效/消耗、背压和清理有聚焦非UI合同。

源90表169304原行和源DB字节mtime、canonical配置保持。目标原Task/Mission/Session/Goal全字段保持；真实预检/消息引起一条memory_chunk、一条memory_file和两条运行容量租约更新，原差异完整保留，不宣称全部目标原行零变化。应用schema3和实际对象/integrity保持，未执行用户数据库迁移。四次实际gpt-6.1-sol请求全部streaming、HTTP200和原Provider reader EOF；复制认证与完整模型目录各一份已退休，关闭预留661913毫秒。
