# 240 Side Sources阅读空间

[Recall与修改前分析](../../artifacts/2026-10-05-connection-workspace-authority/side-composer-plan-240.md)。单agent；只改共享AutoGrowTextarea，不改Sources/Session/Provider协议或CSS最低高度。

真实隔离原238完整会话复现：空Side textarea199px/form262px/阅读viewport261.333px，输入短文后72px；清空再关闭整个Dock/current Return重开再次199px。共享primitive此前只在value/onMount测量，无法在挂载布局完成或width变化后失效重测。初测瞬间实际width未采集，placeholder具体分行原因仍未知；不是把默认rows2猜成十行。现唯一resize读取有效连接非零geometry，新增width观察/相同width与height-only忽略/disconnect与disposed退役，原floor与cap保持。

[真实前后截图和闭合](../../artifacts/2026-10-05-connection-workspace-authority/side-composer-240/README.md)：own81/18174新build首次空框72px/form135px/阅读viewport388.333px，释放127px。短文72，18行实际scrollHeight350px在199px cap内滚动；原稿宽330.667→391.667时height142→123；清空、整Dock关闭/current Return重开72；Side Reference4及原Sources5/5211字符摘要亲自查看。这里只验收英文浅色桌面，不宣称中文深色、Mission/Goal/Provider等其他调用或新stream Rendering已完成。

overlay type60102/build52914 actual0（49.36s）；源码追加解释注释不改变上述构建的运行逻辑。没有UI自动化测试。UI交互一次role selector无匹配，按真实DOM可见文本恢复；是工具定位差异，未作为产品bug。

sole shutdown原fore91109/Native51404 actual0在14:55:47Z，早于固定15:02:49.672Z期限，完整physical/output/request与pair读回；444个新日志行unknown0。13个核心表直接完整原行相等，两个Project仅primary .git目录mtime变化。闭合后所有运行观察器完成才归档自身Bun文件；记录原事实，不使用hash门槛。
当前docs:check及check:architecture-index实际0；git diff --check实际0。
