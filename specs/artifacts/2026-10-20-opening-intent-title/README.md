# 真实开场意图与会话命名

2026-10-20，单agent；[调查和实施方案](../../records/2026-10/2026-10-20-opening-intent-title.md)。共享首次命名按真实human作者识别；Goal创建事务直接从结构化成果命名默认会话；异步命名通过唯一setter按expectedTitle比较写回。

- [原实现失败](before.log)：6项中4项失败，覆盖Goal默认名、人类输入身份/数量、迟到写回和并行Project。
- [24项/95断言](contracts.log)、[后端类型检查](typecheck.log)、[当前暂存源码拓扑](module-index.log)：原句柄53009/6360/22224均exit0。Task标题、用户自选名、Goal幂等重放和流式collector保持当前合同。
- [创建后的成果标题](created-goal-en.png)、[自动执行后的标题](automatic-goal-en.png)：1280×720内置浏览器截图，实际gpt-6.1-sol流式回复TITLE460READY，预算1/1，38,352令牌，控制器正文完整可见。
- [界面手动改名](renamed-goal-en.png)、[重新加载同一会话](reloaded-rename-en.png)、[operator记录完成](completed-goal-en.png)：标题、侧栏和原消息均人工查看。完成是operator明确提交证据，不是模型自行完成。
- [真实持久化与Provider事实](manual-ui-facts.json)、[结果及句柄](results.json)、[数据保留](history-verification.json)：schema2，110 Project/149 Session，原109/147全部身份、归属和目录保留。
- [原生服务结算](native-settlement.json)、[配对授权退休](private-pair-retirement.json)：18737公开shutdown200、原3562 exit0、物理/输出/请求/launcher均结算，秘密扫描通过后复制对退休，来源未写入或刷新。

本轮前端未改，当前开发后端配合459正式前端bundle在自有/ui服务验收；没有单独Vite服务或UI自动化。用户18571页面/进程和真实用户数据库未操作。已有历史技术名称保持其原始数据，完整历史配置保存/恢复性能目标仍未达；不把本轮标题验收扩称Sources或侧栏Rendering最新验收。
