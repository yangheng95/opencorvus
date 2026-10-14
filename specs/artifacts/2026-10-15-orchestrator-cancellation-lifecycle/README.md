# 独立Prompt取消执行终态证据

[方案与Recall](../../records/2026-10/2026-10-15-orchestrator-cancellation-lifecycle.md)。生产取消分类与执行事实、真实主Task Stop和人工视觉复核，不含凭据、UI自动化或完整数据库文件。

| 原图 | 真实范围 |
| --- | --- |
| 01 | 修改前服务重读原426历史，Cancelled与原红色Error details |
| 02 | 新Task真实Sol正文增长中，Running22秒 |
| 03 | 人工Stop后Cancelled29秒，保留部分正文 |
| 04 | 自有页面刷新后同一持久取消结果 |
| 05 | 简体中文切换后返回同一Task |
| 06 | 修复后服务重读旧426历史，原错误详情仍在 |
| 07 | 最终中文已取消29秒，实际阅读往返后正文保留 |

均为1280×720默认桌面viewport原图，已经人工查看。before不是新业务Task旧版Stop；同一旧历史在新旧服务均保持其原错误事实。

`facts/review-result.json.gz`记录新Task、原取消Request/终态/Message、原control输入的terminal/aborted和两scope资源资格。`checks/public-message-read.json.gz`为正式session.messages HTTP200的同一完整取消原因；`facts/original-426-error.json.gz`保留旧错误lifecycle事实。`checks/`包含确定性修改前2 pass/4 fail、修改后22项/56断言、8包typecheck及输入准备错误原件；Prompt mock资格与真实Provider资格在方案中分别注明。

`before/`、`after/`各自保留原Native occurrence、完整配对预检、Provider reader和公开shutdown/物理/output/request/配对退休。实际2条eof和3条eof+1条aborted均200，两个Native scope均exit0。真实验收没有产品成员或工具调用，非自有浏览器页保留。数据库schema保持，未重写历史、清库或发布。

[standby补充复核](standby/README.md)保留原取消回执对已接受idle输入的约束：修改前实际失败、修复后23项/59断言及新18581真实活动Stop。对应源码在57735b87c交付后追加修正，原证据保持，不用旧图替代最后一次真实验收。
