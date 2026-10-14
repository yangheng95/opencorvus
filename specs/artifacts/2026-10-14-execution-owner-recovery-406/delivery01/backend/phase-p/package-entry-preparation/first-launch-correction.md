# package-entry01 原失败与一行辅助修正

普通入口首跑已在 process03 join0 后启动。原tool chunk334b06 exit1，监督脚本parent79780，1791943656113→1791943656124；原600s截止1791944256113。原 `owner.json`、`owner-start.json`、实际wrapper/test/worker/authority源保存于 `../package-entry01/`；evidence01创建但无case，未执行package runner、没有onSpawned target PID或Provider/server。

实际错误：`Windows owned_tree execution requires opencorvus-process-supervisor.exe or OPENCORVUS_PROCESS_SUPERVISOR`。不是exe缺失：当前 `runtime-f99dc82200dae746/debug/opencorvus-process-supervisor.exe` Test-Path为true。

生产 `packages/util/src/process-node.ts:112` 的 `resolveWindowsProcessSupervisor` 读取**监督脚本自身**process.env；薄wrapper仅把该值放入childEnvironment，尚不够让spawnWindowsOwnedTree选择原host helper。现成run-formal.ts本就设置自身process.env。本地辅助故障先修的授权下，只补同一行：

`process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor`

它只影响本次薄监督进程及其明确子环境，不修改用户配置或shell环境；专用Permission外父变量仍从childEnvironment删除。未改生产、generic runner、正式test/worker或故障期待。原01失败不覆写、不重用其600s。

fresh package-entry02/evidence02 的真实原exec85562、parent61428：startedAt1791943710820（2026-10-14T02:08:30.820Z），deadline1791944310820（02:18:30.820Z）。原固定命令为 Bun1.4 `run --cwd packages/opencorvus test test/permission-execution-owner-process.test.ts`。第一个case实际parent-owner已记录wrapperDeadlineAt:null / outerDeadlineObserved:false与自身600s，而外薄scope仍物理600s；不猜测缺失参数。

最终结果与owner joins以原package-entry02/stdout、stderr、owner以及各case公开facts为准；本记录不在过程完成前声称通过。
