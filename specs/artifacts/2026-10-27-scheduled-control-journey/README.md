# 计划任务完整控制体验

[调查、共享审计与实施方案](../../records/2026-10/2026-10-27-scheduled-control-journey.md) · [运行事实](evidence.json)

20张原图均来自独立开发CLI的/ui真实手工操作，1280×720桌面暗色界面，逐张人工查看。没有UI自动化、截图基线或像素断言。646不复制认证；647/648使用成对临时认证与完整模型目录，原用户18571和数据库不变。

| 原图 | 实际观察 |
| --- | --- |
| [01-empty-scheduled-page.jpg](01-empty-scheduled-page.jpg) | 646原空列表 |
| [02-create-future-form.jpg](02-create-future-form.jpg) | 646远期新建表单 |
| [03-created-future-detail.jpg](03-created-future-detail.jpg) | 646原创建详情 |
| [04-paused-detail.jpg](04-paused-detail.jpg) | 646原暂停详情 |
| [05-paused-row-all-before.jpg](05-paused-row-all-before.jpg) | 646原暂停列表仍显示下次日期 |
| [06-paused-filter-before.jpg](06-paused-filter-before.jpg) | 646暂停筛选仍显示下次日期 |
| [07-paused-search-global-before.jpg](07-paused-search-global-before.jpg) | 646组合筛选 |
| [08-paused-list-english-after.jpg](08-paused-list-english-after.jpg) | 647暂停列表英语修复 |
| [09-paused-detail-after.jpg](09-paused-detail-after.jpg) | 647暂停详情英语修复 |
| [10-resume-original-date-after.jpg](10-resume-original-date-after.jpg) | 647恢复原日期 |
| [11-manual-run-observation.jpg](11-manual-run-observation.jpg) | 647原界面假超时 |
| [12-original-run-success-after-refresh.jpg](12-original-run-success-after-refresh.jpg) | 647刷新历史后原执行成功 |
| [13-original-model-result-opened.jpg](13-original-model-result-opened.jpg) | 647实际原结果会话 |
| [14-current-paused-list-en.jpg](14-current-paused-list-en.jpg) | 648最终暂停列表英语 |
| [15-current-resume-calendar-en.jpg](15-current-resume-calendar-en.jpg) | 648最终恢复原日历英语 |
| [16-current-running-en.jpg](16-current-running-en.jpg) | 648真实运行中反馈 |
| [17-current-request-after-fifteen-seconds.jpg](17-current-request-after-fifteen-seconds.jpg) | 648自动成功回读（观察时17.7秒，执行本身6.386秒） |
| [18-current-result-session-en.jpg](18-current-result-session-en.jpg) | 648原结果会话 |
| [19-current-paused-list-zh.jpg](19-current-paused-list-zh.jpg) | 648最终暂停列表中文 |
| [20-current-success-paused-detail-zh.jpg](20-current-success-paused-detail-zh.jpg) | 648最终成功与暂停详情中文 |

647实测同一Fire约49.264秒成功，界面却默认15秒超时报错。修复复用已有serverSettledRequest，单一mutationOwner显示运行状态，回执后自动刷新定义和历史。648仅一次真实gpt-6.1-sol流式调用，6.386秒成功、结果可打开、定义仍暂停并保留原2099日历；此短模型执行不能冒充大于15秒的模型复测。独立正向网络服务测试通过两个生产宿主传输验证真实17秒HTTP回执，不属于UI自动化或模型端到端验收。

本批最多4次，647消耗3次、648消耗1次，累计218→222。648明确引用647已实际成功的同源凭据事实，启动前再次核对源身份、有效期和投影，没有虚构新付费预检。两次服务/原exec/原生宿主/启动器/请求均已结清，各成对副本已退休，源认证和模型目录元数据保持。648关闭HTTP200、双进程0，保留1049542ms结清余量。

中文暂停列表/详情、英语运行中和实际结果均人工复核；中文运行中未另耗模型请求复测。后台重试、恢复、容量及项目隔离是本轮共享代码审计证据，不能宣称每个后台场景新做过付费运行。
