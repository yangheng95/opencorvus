# 长正文与来源阅读证据

见[Recall、根因与验收边界](../../records/2026-10/2026-10-14-long-source-reading.md)。单agent在当前SQLite版本1隔离库，通过正式开发服务的`/ui`完成真实交互；所有截图均人工查看，没有UI自动化断言。

## 结论与证据

- [后端事实检查](checked-facts.json)：主会话38消息，37份不同的完成assistant正文，36次正式Read、36组四行Source范围；每个Source都绑定同一消息的completed Tool。资料是一个144行QA文档，不是36篇独立研究。
- [03](03-early-reading-later-output.jpg)：真实输出从早段推进到完成时，原阅读段仍可见。新建长侧聊后，[04](04-long-reference-open.jpg)主区跳顶；独立诊断[13](13-auth-new-side-jump.jpg)在尚未展开引用时复现。
- [连接记录](new-side-connection-events.json)与[树替换记录](new-side-reading-events.json)：创建耗时8929ms，健康探测超时后完整连接恢复。preserve分支没有重绑reader，但Virtualizer已随treeEpoch重建；内容高度从长历史短暂收缩到827，再恢复6319，主scrollTop停在0。
- 修复后[14](14-after-before-create.jpg)和[15](15-after-new-side.jpg)保持R06—R08；[18](18-after-rebind-settled.jpg)通过正式连接保存入口完成同源重建后，仍回到相同正文、Source及1260.67位置。该次新建未触发健康超时，所以分别验收了新建和明确的同源重建，没有伪称它们是同一事件。
- [19](19-empty-reference-en.jpg)、[20](20-empty-reference-zh.jpg)：未继承完成历史的侧聊现有中英文说明；[21](21-independent-reference-reading.jpg)右栏独立滚动，主区保持R06—R08。
- [22](22-reference-source-copy.jpg)原生控制点击后的粘贴仍是此前网址；改用浏览器控件点击后，剪贴板与实际粘贴均为准确文件路径和9-12行，[23](23-reference-source-copy-confirmed.jpg)。保留两次事实，不根据原生工具路径的异常修改产品剪贴板。
- 原运行41次、诊断04和复验05各3次，共47次实际`gpt-6.1-sol`流式请求，全部200/EOF。各服务的原进程句柄均join exit0；原、04、05的物理结算和配对清理记录在对应目录。引用副本不计新增工具执行或来源。

## 调查器失败与范围

首次只读启动缺少用户目录环境变量，修正后02成功。03在认证装载前错误地要求配置文件没有生产补充的`$schema`/terminal字段，原进程正常退出；04只核对本次依赖的模型/profile字段。05准备时将构建目录误写为`dist-vite/ui`，复制报错后修正；服务已从正式解析器选中的当前workspace `dist-vite`冻结UI，不声称它加载了稍后补齐的独立bundle。修复后实际新文案和重建行为已人工核对。以上失败记录保留，没有使用截图/源码字符串断言替代验收。

构建、renderer public surface、Overlay类型检查和两语言键检查通过。原始Runtime日志记录286次ResizeObserver未交付通知；它不能单独作为闪烁根因，未声明已修复全部通知。长侧聊创建耗时仍需追查共享fork/消息持久化成本。Task/Mission/成员专有入口、重启及并行多项目的真实视觉验收尚未完成；本轮只交付已确认的主阅读恢复与空引用解释。
