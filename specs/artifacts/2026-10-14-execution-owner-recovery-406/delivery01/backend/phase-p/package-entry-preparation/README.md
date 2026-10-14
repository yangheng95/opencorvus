# 正常 package 入口：仅外部 600s 薄监督（尚未执行）

Root 授权准备；完整源 `../run-package-entry.ts`，本目录保存其待审原像。没有修改 production、通用 runner、正式 test 或 worker。只复用 `NodeProcess.run` owned_tree 和已有 `expectedTestProcessSupervisor`，没有复制 runtime factory。

启动前必须 process03 已原结算；下一次两个新目录 `package-entry01` 与 `package-evidence01` 均不存在。精确命令：

```powershell
$env:PATH='D:\myhexin-local\opencorvus\.tmp-product-iteration\sse-compression-305\bun140\bun-windows-x64;'+$env:PATH
bun .tmp-task-question-recovery-406/phase-p/run-package-entry.ts package-entry01 D:\myhexin-local\opencorvus\.tmp-task-question-recovery-406\phase-p\package-evidence01
```

不提前创建目录；脚本用 mkdir 非recursive保证fresh。脚本从第一条声明固定startedAt+600000，源复制/setup也计入，不因日志或case重新延长。实际子命令固定为同一Bun executable与以下argv：

`run --cwd packages/opencorvus test test/permission-execution-owner-process.test.ts`

环境改动仅在独立 childEnvironment 副本：

- 明确删除 `OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT`，不读取/输出其旧值；不改调用者全局环境。
- 指定已有受控监督器路径 `OPENCORVUS_PROCESS_SUPERVISOR`。
- 指定本次绝对公开证据目录 `OPENCORVUS_PERMISSION_OWNER_EVIDENCE`。
- 其他环境继承交正式包runner按它当前隔离规则处理；日志只记录键名，不记录继承值。未读取/复制auth/models/真实凭据。

外部 owned_tree 原600s物理监督，与被测test的可观察预算分开记录。test确实没有专用outer参数，应按正式合同输出 `outerDeadlineObserved:false / wrapperDeadlineAt:null`，每个case自身600s/保留60s、child180s、HTTP/资源30s。通用package runner原900s不改；外部监督若先到仍以原600s收尾，不能伪称被测case知道外父身份。原过程约3分钟，实际没有完成仍照实失败，不能续期。

脚本只执行正式选文件命令；onSpawned捕获原PID/occurrence；await result及同一handle的physical/output，写stdout/stderr/owner。异常仅操作自己onSpawned的原handle，保持原外部预算。失败原receipt/errors保留，不把terminate当自然成功。正式test负责各case的Provider/resource/handler/managed cleanup；本层不二次遍历删目录。

当前未首跑，无owner/deadline/PID可报。process03仍由其不同原exec50614独占运行；本准备不可当作普通package入口已通过。需Root全文审源码/参数后另行授权。
