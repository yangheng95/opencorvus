# 命令面板全历史搜索验收

[Recall与实施前方案](../../records/2026-10/2026-10-14-command-search.md)。单agent在独立开发服务 `http://localhost:18521/ui/` 实际交互、截图并人工复核；没有UI自动化测试。本轮搜索覆盖当前未归档记录，归档投影的字面搜索合同另由后台测试资格。

## 实际页面

|截图|真实观察|
|---|---|
|[01](01-before-missing-history.jpg)、[02](02-before-existing-history.jpg)|修前搜索旧中文标题无匹配，但展开项目能够打开同一历史与Sources。|
|[03](03-after-history-search.jpg)、[04](04-after-shortcut-sources.jpg)|修后搜索得到原Session，Ctrl+1打开原38条消息、36组来源的历史。|
|[05](05-after-search-page.jpg)、[06](06-after-more-results.jpg)|第一次修后12条结果加载至17条，列表可滚动；随后检查发现最后一个按钮移除后输入焦点丢失，继续修复。|
|[07](07-after-empty-en.jpg)|英语真正空结果；第三方默认可访问计数仍有旧英文问题，随后改用公共翻译接口。|
|[08](08-final-more-focus-en.jpg)|最终18条候选，实际加载更多完成后焦点回到输入，英语候选数正确。|
|[09](09-final-literal-query-en.jpg)、[10](10-final-literal-result-en.jpg)|09是快速改词后的Loading中间态，10才是包含下划线、百分号、反斜线及中文的精确结果。|
|[11](11-final-history-zh.jpg)|中文旧标题候选及可访问名称，随后Ctrl+1打开原Session。|
|[12](12-final-timezone-zh.jpg)、[13](13-final-timezone-options-zh.jpg)|共享组合框的另一个生产入口：实际展开419个时区，中文计数和候选名称；取消表单，未保存定时任务。|
|[14](14-final-network-error-zh.jpg)、[15](15-final-network-details-zh.jpg)|精确自有服务正常关闭后真实读取失败，中文摘要/重试及原TypeError诊断可见。|
|[16](16-final-retry-restored-zh.jpg)|同一页面、原查询在同URL新进程恢复后实际点击重试，得到原Session，输入重新聚焦。|
|[17](17-final-network-error-en.jpg)|最后关闭自有服务后英语错误、Details及Retry，随后关闭页面。|

截图均为原始1280×720页面记录，没有编辑、基线断言或像素比较。AX（Accessibility Tree，可访问性树）只辅助读取焦点、计数与对象身份，不代替人工视觉复核。Tab12、13、14均已关闭。

## 数据、服务与模型事实

- [before-ledger.json](before-ledger.json)：原limit12实际为6个Chat和6个Project并有nextCursor；已有服务器search直接返回原Session。
- [literal-session.json](literal-session.json)：正式创建空Chat返回201，标题更新200，身份为`ses_-zUS13uVxzzlSBCKZmJ4`；未合成用户或模型消息。
- [recovery-ledger-requests.json](recovery-ledger-requests.json)：恢复服务实际12条Work Ledger路由请求日志，日志未记录querystring，也包含主列表请求，不能逐条归因命令面板。
- [native-summary.json](native-summary.json)：四个独立occurrence各2条实际gpt-6.1-sol流，合计8条HTTP200/EOF（End of File，流正常结束）；完整最终reader事实分别见`native-before/`、`native-after/`、`native-final/`、`native-recovery/`内`provider-final.json`。
- 同目录保留凭据usable、模型目录projected、实际请求模型/streaming三项预检、公共shutdown、Native物理退出/输出排空/请求清理及auth+models配对退休。没有凭据内容。原句柄76184、59447、28421、41175均在实际执行时join并返回0；回忆记录注明工具句柄证据来源，不伪造独立原退出文件。

## 检查与边界

[ledger-tests.log.gz](ledger-tests.log.gz)保留官方package测试入口的13项通过、48断言；直接覆盖旧记录、字面字符、中英/ASCII大小写、Project边界、规范cursor、Chat/Mission/Task、归档合同与原事件投影。初次遗漏当前必填Mission字段的失败及修正后通过日志均保留。

前端类型检查`overlay-typecheck-localized.log.gz`原38160为0，独立Node Vite构建`ui-build-final.log.gz`原69675为0。第三方翻译回调的最终类型断言不改变构建后手工验证的运行时行为。后端最终类型检查`backend-typecheck-verified.log.gz`原67257为0；`i18n-check-verified.log.gz`、`docs-check-verified.log.gz`原命令均0。之前的本地路径错误、Button缺必填参数、第三方literal类型及共享compaction类型失败日志都保留，未用后来结果覆盖。

`*-final.log`中后端空日志及旧i18n/docs输出对应跨上下文未保留原句柄的检查，不用空日志推断原退出；确认原进程已退出后，重新执行上述`*-verified`检查并取得实际退出。日志gzip为原字节压缩，避免构建器尾空白干扰Git差异检查。

不同URL/凭据authority切换的迟到响应没有本轮手工端到端资格；快速改词没有人为延迟竞态资格。原生日期/时间控件的浏览器格式不在本轮共享组合框验收内。整体Sources/Rendering与此前复制耗时波动仍属持续goal，不能用本轮搜索通过宣布完成。
