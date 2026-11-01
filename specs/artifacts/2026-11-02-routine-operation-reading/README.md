# 常用操作阅读证据（880）

来源为879-final已合格闭合的完整隔离数据。本人通过项目CLI开发服务38577/38578的后台独立页面实际交互，14张JPEG均已人工查看；不操作用户18571或窗口，不运行UI自动化。

- [01-before-mission-operation-en.jpg](01-before-mission-operation-en.jpg)：原始Mission管理状态展开；技术ID与输入、真实输出可见。
- [02-before-member-artifacts-en.jpg](02-before-member-artifacts-en.jpg)：Task801选base-tester并展开5操作；artifact_publish技术名与读取来源可见。
- [03-after-mission-actions-en.jpg](03-after-mission-actions-en.jpg)：首次role点击后截图；视口仍在结尾，确认Complete Mission；未作为6操作展开通过。
- [04-after-mission-expanded-en.jpg](04-after-mission-expanded-en.jpg)：使用原生Expand后向上滚动；视口抵达原用户请求；未作为展开内容通过。
- [05-after-mission-inputs-en.jpg](05-after-mission-inputs-en.jpg)：原生向下阅读已展开6操作；Find specialist capabilities及真实capability_search输入可见。
- [06-after-mission-inputs-zh.jpg](06-after-mission-inputs-zh.jpg)：设置语言为简体中文并返回；同一内容中文名称，工具ID/字段事实保留。
- [07-after-mission-state-zh.jpg](07-after-mission-state-zh.jpg)：原生展开管理Mission状态；中文名称、真实mission_state输入与输出。
- [08-after-task-artifacts-zh.jpg](08-after-task-artifacts-zh.jpg)：Task801展开4操作组；选取产物来源及读取成员消息、原始输入。
- [09-after-member-artifacts-zh.jpg](09-after-member-artifacts-zh.jpg)：选择base-tester并展开5操作；保存工作产物/读取文件、独立Sources行和输入可见。
- [10-after-member-source-zh.jpg](10-after-member-source-zh.jpg)：实际点击operator-note来源；应用内文件面板读到OPERATOR_WORKING_801。
- [11-after-member-raw-input-zh.jpg](11-after-member-raw-input-zh.jpg)：返回成员并展开artifact_publish输入；实际为原位全文展开，6字段/15来源引用可检查。
- [12-after-member-raw-input-en.jpg](12-after-member-raw-input-en.jpg)：切英文并回到同一成员输入；英文名称和原始参数结构保留。
- [13-after-real-copy-paste-en.jpg](13-after-real-copy-paste-en.jpg)：点击复制输入后真实Ctrl+V粘贴到主输入；8113字符原始JSON、6字段/15来源引用；随后清空，未发送。
- [14-after-task-read-en.jpg](14-after-task-read-en.jpg)：关闭右面板后展开artifact_read输入；Read work artifact、真实reads数组及结果结构可见。

[手动操作](actions.csv)、[完整非敏感资格](verification.json)、[根因与范围](../../records/2026-11/2026-11-02-routine-operation-reading.md)。

修改仅为28个新名称、待办名称修正、实际工具ID登记及共享规范化，原始输入/输出/Sources未重写。实际复制粘贴验证6字段和15来源引用；仅为未提交草稿，随后清空。两阶段0模型请求、累计1260，public shutdown200，原句柄39218/40203均exit0，四份配对认证/模型目录副本退休。完整资格258669→258671→258673行，schema9/92表、全部旧业务行、100项目业务文件/Git、229附件、来源DB与原认证/模型目录均保留。

边界：实页覆盖已有Mission801、Task801及base-tester可见操作，不伪造其他28键的完整视觉覆盖；todo及无保留调用的协调工具没有单独实页样本。03/04保留首次截取/滚动过程，不作为目标展开内容通过；05/06是真实目标区域。首次最终构建调用因私有shell引号错误未启动构建，改为落盘脚本后原验收exit0。此轮未执行历史消息中的命令，没有发布版本、tag、Release或PR。
