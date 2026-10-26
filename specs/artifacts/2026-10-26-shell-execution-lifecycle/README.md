# 直接用户命令的规范执行状态

[Recall、共享根因与方案](../../records/2026-10/2026-10-26-shell-execution-lifecycle.md) · [脱敏原事实](evidence.json)

直接用户shell原来保存了完成消息和工具结果，却没有发布该输入的执行生命周期，公开参与者读取因而一直Pending。修复生产者绑定原输入和原物理所有者，复用唯一生命周期发布器；正常命令完成、原用户停止和原执行/恢复错误分别保留completed、aborted和error。原命令非零退出仍是完整完成的命令，不伪装为进程执行故障。界面读取同一事实，没有新增状态推断或UI（User Interface，用户界面）代码。

| 实际原图 | 人工复核 |
| --- | --- |
| [01](01-running.jpg) | 原中文命令和实时输出可见，Running及原Stop控制生效 |
| [02](02-stopped-occurrence.jpg) | 实际点击原Stop后，原退出1/输出/中断说明保持，参与者tooltip（提示）为Stopped |
| [03](03-completed-occurrence.jpg) | 另一原命令自然退出0，参与者tooltip为Completed |
| [04](04-reopened-completed.jpg) | 重开渲染页面后同一原轮次及完成输出保持；不是原生服务重启 |

四张1280×720实际视口原图均已人工查看，没有拼接、改图、截图基线或UI自动化。执行由真实公开session.shell API（Application Programming Interface，应用程序接口）发起；停止与参与者读取由真实UI完成，不声称存在已验收的UI命令提交入口。原运行和完成各有同一输入的streaming/terminal两条规范事件，原Message及Tool身份对应。

首次合格红测试0通过/3失败，证明运行和完成的真实公开读取仍为pending及双项目缺少终态。错误/重放/恢复、原输出/退出、共享轮次/终态与多项目取消均进入原检查器验证。提交前追加“不可变completed助手下的open Tool恢复”终态正向断言，由该生产者刚收敛的原Tool失败事实发布error；该异常历史分支由后端合同验证，未声称在633实页重演。完成历史缺少原生命周期的旧记录没有自动回填。

最终当前源码8文件57项160断言通过；完整后端及触及测试类型、当前文档检查通过。原消息、工具和规范生命周期的共同身份、明确错误及独立输入仍由生产合同验证；实页资格只覆盖633实际运行、手动停止、自然完成和渲染页面重开。

633共4次实际gpt-6.1-sol流式请求，全部200/EOF settled，累计211；两个直接用户命令自身没有LLM（Large Language Model，大语言模型）生成步骤。原tab16关闭，shutdown200，原exec32077/native/launcher（原生宿主/启动器）均0，提前847470ms关闭。两个原命令精确身份与terminal/output/settlement全部结清，复制认证/完整模型副本退休。源92表22351行及目标640条关键事实保持，仅原Chat活动时间推进；12组原附件保留，schema（结构）仍8。未操作用户18571、数据库或窗口，版本/发布定义保留。
