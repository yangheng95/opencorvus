# 原待机取消回执保留

[方案与Recall补充](../../../records/2026-10/2026-10-15-orchestrator-cancellation-lifecycle.md)。当前23项/59断言、8包typecheck，原idle输入按真实CancellationReceipt保持；原Provider错误与活动取消分类继续通过。

`checks/contracts-before.log.gz`是修正夹具后原待机例的实际失败：原idle被当前publisher误改aborted。`fixture-preparation-error.log.gz`保留首版遗漏run-once wake消费/结算造成的hook超时；`fixture-stop-request.json.gz`、`fixture-physical-retired.json.gz`与`stop-fixture.ps1.gz`证明只通过原请求协议精确收尾自有夹具。准备失败不计通过资格。

`01-active-streaming.jpg`、`02-active-cancelled.jpg`、`03-after-reload.jpg`为最后18581服务的真实Sol活动Stop、Cancelled45秒与刷新结果，1280×720默认视口，均已人工查看。它们证明活动路径保持正确；已接受idle边界由原后端回执合同证明，无UI自动化。

`facts/review-result.json.gz`及`checks/public-message-read.json.gz`核对原Task/Message/epoch/input/取消来源和正式HTTP200。`native/`保留完整配对预检、四条实际Sol流（200，3 eof/1 aborted）、公开shutdown200、exit0及物理/output/request/配对退休。没有产品成员或工具调用、schema变更、清库或发布。
