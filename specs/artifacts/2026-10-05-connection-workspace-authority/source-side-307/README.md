# 307 窄侧聊来源与真实流式返回

[实施前Recall与范围](../source-side-plan-307.md)。单agent，没有开发子agent或产品成员委托。本轮是306共享Sources层级在380px普通Side中的真实验证，未修改生产代码，也不把它冒充原Research Studio子成员全帧验收。

## 实际页面和阅读证据

独立正常/ui18272、当前main-cvYkVasB.js均实际HTTP200。普通主会话ses_-zUSEi1x5zz73NrejkVr，Side ses_-zUSEhxzazzE6HoremJJ，Project prj_hicgz38EWFfw8wdEDiGV；Side metadata记录真实sourceSessionID和继承消息，parent_id为空。一次websearch numResults5返回五条真实Exa来源，没有注入或改写消息/来源。

[窄栏展开](live-01/03-narrow-expanded.png)、[长标题换行](live-01/10-narrow-source-titles.png)人工查看：首条链接保留完整标题与域名；“4 more sources”原生Enter展开后保持紧凑，MDN/W3C长标题按可用宽度换行。02-side-summary-before-navigation.png实际是回复末段，原拍摄时来源在视口上方；不把它作为Sources收起态证据。首条摘要通过原生Tab进入、PageDown到中段。

同一Side第二个真实用户回合请求12节分析。提交后外层原生滚轮上翻到来源，再关闭/重开整个Dock。[生成中关闭前](live-01/05-live-before-close.png)、[立即重开](live-01/06-live-reopened.png)、[后续生成](live-01/07-live-later-growth.png)、[完成后](live-01/08-completed-reading.png)均人工复核：来源分组和摘要保持展开，当前原文段落保持。外层top396、内层top250.6666717529297；内层client287/scrollHeight1692，Dock实际宽380。

后续正文继续增长时，外层content高度2974→2998→5869，完成后7302；外层top始终396，内层读位始终250.6666717529297。生成结束输入框重新出现，使外层client466→388，阅读top仍保持。[真实长回复末段](live-01/11-completed-body-tail.png)另在主动滚至末尾后查看。

## 对应实际Provider时间

5050字符正文属于msg_g0VXlIQC400P0zw7WZId。实际对应Provider source reader为2026-10-11T17:09:27.308Z至17:10:58.053Z，EOF正常结束。[完整身份与时间关联](live-01/actual-reader-timeline.json)从关闭后的canonical SQLite与真实Provider记录按assistantMessageID连接，包含原始reader元数据；不是依据Working文案推断。

- before-close：17:09:51.816Z。
- dock-closed：17:09:52.219Z。
- dock-reopened：17:09:52.647Z。
- after-reopen-reading：17:09:52.709Z。
- later-growth-reading：17:10:29.803Z。

以上五次均落在同一实际reader范围内；提交开始/接受本来早于reader首字节，completed-reading与page-closed本来晚于EOF，保留其真实时间。只读几何和时间表辅助人工截图，不是UI自动化断言，也不能证明采样间每一帧均无Rendering。

## 边界与交付

本轮没有发现需生产补丁的新缺陷，没有为形成代码差异制造修复；不新增/修改/运行UI自动化测试。未改变UI代码和构建产物，因此未重复构建或跑无关后端测试。新spec索引执行当前docs和architecture检查。原Research Studio子成员全帧、自然单→多瞬间、两条/单条/file/document、浅色和Tauri原生窗口仍未给出本轮通过资格；持续goal保持active。

完整auth/models配对、usable/projected/实际gpt-6.1-sol流式通过；累计10次实际请求HTTP200/EOF，固定600000ms和20请求上限未改变。自己的71页关闭；Native74832/Host65520物理、输出、请求正常关闭，原前台18119实际exit0，端口18272及配对凭据退休由closure-readback独立确认。全部archive/checker结束后保管本轮5个Native文件。

物理完成17:12:19.599Z，固定deadline17:17:11.458Z，余291859ms，满足提前四分钟收尾目标。原手工余量探针的PowerShell JSON自动DateTime转字符串丢掉UTC偏移，产生错误八小时余量；原错误单独保留，改用DateKind String/精确ISO解析重跑，当前[正确余量](live-01/closure-deadline-margin.json)是独立可核对事实，不影响生产截止或原进程行为。

完整canonical来源/消息/工具输出和脱敏Provider事实保留；11311行实际运行日志无未知时间行，无损gzip展开逐字节一致，原日志在私有目录保留。公开文本初扫76份凭据命中0，最终扫描随提交再次执行。范围提交并正常同步上游，下一批继续单agent自主调查。
