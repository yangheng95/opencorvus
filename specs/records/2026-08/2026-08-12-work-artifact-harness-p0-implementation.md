# Work Artifact Harness P0 实施记录

Status: P0 implemented; focused validation and hermetic compiled Windows x64 package acceptance passed; follow-up commits await safe remote reconciliation

## Recall

### 用户原始要求

- 在已审定的 Work Artifact Harness 与 Skill 基建方案上开始实施。
- 使用独立 agent 全程监督实施质量。

### 本阶段范围

P0 只把当前已生产资格化的 PPTX（PowerPoint Open XML Presentation，PowerPoint 开放 XML 演示文稿）纵切片迁入统一基础设施。PDF、DOCX、XLSX、OCR（Optical Character Recognition，光学字符识别）、数据、图像、归档和媒体仍属于后续 profile，不在本提交中暴露。

### 验收指标

1. 一个 `WorkArtifactProfileRegistry` 是当前已资格化 profile、操作、MIME、Skill resource、运行时和限制的机器事实源。
2. 一个 `work-artifacts` Skill 是 Work 的内置入口，使用简洁 `SKILL.md` 和一层 profile references；旧 `office-artifacts` 源和生成 payload 同步删除。
3. 类型化工具改为格式无关的 `work_artifact_inspect | author | validate | deliver`。PPTX 未实现 transform，因此 registry 不声明 transform，也不创建空壳 transform 工具。
4. `validate` 生成绑定 source SHA-256、profile、运行时修订和 fresh render 摘要的 receipt；`deliver` 必须消费该 receipt，并对最终候选重新执行完整验证。
5. OfficeCLI 只作为 `office.presentation@1` 的 adapter/runtime 保留。旧 `office_artifact_*`、Office 专用 Skill 和 Office 专用 runtime lock 装配不再是公开事实源。
6. 统一 runtime lock 只证明上游来源；最终 target package manifest 记录权限归一/签名后的包内摘要、类别、架构和模式，运行时校验最终 manifest。
7. POSIX（Portable Operating System Interface，可移植操作系统接口）权限按 executable=`0755`、shared library/data=`0644` 分类；native magic 只做漏登记审计。
8. 聚焦正向测试覆盖 registry、Skill、权限表面、receipt 绑定、运行时/包 manifest 和权限分类；真实打包路径执行 OfficeCLI 的 PPTX 生命周期 checker。

### 硬约束

- 以 `specs/records/2026-08/2026-08-12-work-artifact-harness-and-skill-infrastructure.md` 为设计事实来源。
- 一次性替换公开入口，不保留别名、双读、fallback（后备路径）或旧协议兼容层。
- Skill 负责工作方法、逐步披露和质量指导；profile registry、Harness、权限和运行时 manifest 负责机器能力与安全。
- 不使用关键词 host router 教模型选工具。
- 不修改或运行 UI（User Interface，用户界面）自动化测试；本阶段无 UI 改动。
- 保护当前大型 dirty worktree 中与本任务无关的用户和并行任务改动；最终只提交本任务 pathspec。
- 不为收敛远端分叉自动 merge、rebase、force push 或创建额外 worktree。

### 已读资料

- `AGENTS.md`
- `specs/current/architecture/04-extensions.md`
- `specs/current/architecture/17-code-work-agent-platform.md`
- `specs/records/2026-08/2026-08-12-work-artifact-harness-and-skill-infrastructure.md`
- `packages/opencorvus/src/work/harness.ts`
- `packages/opencorvus/src/tool/{office-artifact,global-tools,tool-id-catalog,delegate-agent}.ts`
- `packages/opencorvus/src/office-artifact/{presentation,runtime/runtime-lock}.ts`
- `packages/opencorvus/src/skill/{skill,eligibility,required-tools,builtin-payload}.ts`
- `packages/opencorvus/src/skill/builtin/office-artifacts/**`
- `packages/opencorvus/src/permission/invocation.ts`
- `packages/opencorvus/script/{officecli-runtime-lock,build-runtime-binaries,build-artifact,runtime-executable-contract,build,build.local}.ts`
- `script/{package-native-binary,package-linux-binary,check-release-assets}.ts`
- `packages/opencorvus/test/{execution-authority-tool-surface,process-authority-runtime}.test.ts`
- `packages/opencorvus/test/script/runtime-executable-contract.test.ts`
- `skill-creator` 指南：Skill 保持短小、详细格式知识放一层 reference、不得添加无关 README/安装文档、生成 payload 必须由源 Skill 确定性产生。

### 全仓搜索结果与影响面

- `office_artifact_*` 进入 Work tool pool、全局工具注册、工具 ID catalog、permission effect、delegated Work child 提示词和架构文档。
- `office-artifacts` 进入 Work 默认 capability assignment、Skill 源目录、生成 payload 和架构文档。
- OfficeCLI lock 被运行时验证、构建下载、许可复制、package required-files 和发布检查直接引用。
- 当前运行时直接用上游 asset SHA-256 校验包内 OfficeCLI；签名后的包内摘要尚无独立 manifest。
- 当前 native binary discovery 在 POSIX 将发现的 executable、shared library 和 native addon 一律改为 `0755`。
- 当前 `validateOfficeArtifact` 返回 fresh renders，但没有验证 receipt；`deliver` 只消费 source SHA 和 slide metadata 后重跑验证。
- 当前 HEAD 不包含 Office Artifact 生命周期的独立聚焦测试；必须补齐，不能把通用 Process 测试当作完整验收。

### Git 与远端事实

- 当前分支 `main`，实施起点 `51c3f3dc5`，其中仅包含已审定方案。
- `origin/main=640984800`，共同祖先 `728c76f0c`；本地 ahead 1 / behind 2。
- 远端两提交是 AGENTS 推送规则调整和 `v0.0.42-beta` 发布准备。方案 spec 只存在于本地提交，远端没有显式删除它；`git diff HEAD..origin/main` 的 `D` 是比较方向，不是删除意图。
- 远端修改 package 版本、测试运行器、AGENTS 与 spec 索引，但没有修改当前 Work Artifact 源路径。实现可以继续，最终 push 必须因分叉停止并报告，除非期间出现用户授权的安全收敛路径。

### 独立监督 agent 反馈

- 用户明确要求监督；已启动只读 `p0_work_harness_supervisor`，禁止修改和再次委托。
- 监督门槛：receipt 必须绑定 source/profile/runtime/renders；不能只重命名工具；PPTX 不得声明空壳 transform；旧入口全仓同步替换；最终 manifest 在权限归一与签名后生成；native magic 只能审计漏登记；mock 不能替代真实包内 OfficeCLI 生命周期。
- 监督在首批 lock 中阻止了不实 `network: denied`：OfficeCLI 官方只证明可禁自动更新和 resident，没有 no-network 开关；当前仓库也没有跨平台进程网络沙箱。P0 因此在 profile、qualification matrix 与 runtime lock 统一声明 `adapter_inputs_only`，只证明 canonical attachment、无 URL 参数、隔离 HOME/cache 和禁更新。该状态不得冒充操作系统断网；真正的外联拒绝 checker 留作 profile 升级前的明确未完成项。
- 独立监督完成状态：最终只读交付复核完成，无未解决代码或验收 finding；唯一剩余交付状态是远端分叉与并行待推提交尚未安全收敛，不是实现缺口。

## 实施切片

### Slice 1：统一 profile 与生命周期

- 新建 `src/work-artifact/profile-registry.ts`。
- 将 PPTX 实现迁入 `src/work-artifact/presentation.ts`，使用 `office.presentation@1` profile。
- 将类型化工具迁入 `src/tool/work-artifact.ts`。
- 增加 receipt schema、确定性 digest 和 deliver 对 receipt 的绑定/复验。
- 同步 Work tool pool、delegation、权限与架构文档，并删除旧公开入口。

### Slice 2：Skill

- 新建 `src/skill/builtin/work-artifacts/SKILL.md`。
- P0 只带 `references/common-lifecycle.md`、`office-presentation.md`、`review.md`、`security.md`。
- 重新生成 `src/skill/builtin-payload.ts`，确认旧 Skill 不在源或 payload 中。

### Slice 3：运行时和打包

- 用 `runtime/work-artifact-runtimes.lock.json` 替换 OfficeCLI 专用 lock。
- 增加最终 `target-package-manifest.json` schema、生成器和 verifier。
- 构建 staging 在权限归一后生成 manifest；签名发行路径在签名后重新生成/验证最终 manifest。
- 权限分类由显式 manifest 决定；magic/扩展名扫描只报告漏登记 native closure。

### Slice 4：验收

- 聚焦 schema/registry/Skill/tool/receipt/runtime/package/permission 正向测试。
- 从实际 packaged runtime 路径运行 PPTX author、inspect、validate、receipt、deliver checker；检查每张新鲜 PNG。
- 运行相关 typecheck、docs check、package permission/archive checker。
- 交给同一只读监督 agent 审查完整差异和证据；修复后再次复核直到无未解决发现。

## 实施日志

- 2026-08-12：完成统一 profile/qualification registry、四个通用 Tool、`work-artifacts` Skill 与生成 payload；PPTX 未声明空壳 transform。
- 2026-08-12：receipt 改为 canonical Attachment 可见副本 + 同 Session 已完成 `work_artifact_validate` Tool Part 的 host-owned authority；deliver 复核 authority、source/runtime/render bindings 后重新执行完整校验。
- 2026-08-12：统一 runtime lock、target package manifest、PE/ELF/Mach-O 架构、staging/final phase、签名身份、SHA/size/mode 和 archive 解包后真实 smoke checker 已接入打包链路。
- 2026-08-12：类 Unix executable/shared/data 权限拆分；Windows 任务目录用当前 SID 的非继承 ACL；进程总墙钟与 combined stdout/stderr 上限成为生产 adapter 硬约束。
- 2026-08-12：独立监督阻止了伪 `network: denied`；正式设计明确允许 OfficeCLI P0 诚实标记 `adapter_inputs_only`，不声称操作系统断网。
- 2026-08-12：构建生成 qualification matrix，锁定 Tool schema SHA、Skill resource、runtime commit/lock revision、五个公开发行目标和强制 package checker；lock 中 Windows arm64/musl 资产仍是候选，不冒充已资格化公开目标。
- 2026-08-12：Overlay 三条构建、native CLI、Linux bundle 均在签名/权限归一后生成 final manifest，再生成 payload stamp；staging manifest 会被运行时和 final checker 拒绝。旧 `build.local.ts` 直传 GitHub Release 的第二发行面改为明确错误，统一由根 package pipeline 发行。
- 2026-08-12：全包 POSIX 权限归一为 directory/executable=`0755`、shared library/data=`0644`；归档头逐项拒绝链接/设备/危险路径/Unicode 或大小写碰撞，Windows 额外拒绝 ADS、保留设备名和尾随点/空格。Windows 私有工作目录使用当前 SID 的非继承 ACL，并用短临时路径避开 OfficeCLI 深路径渲染停滞。
- 2026-08-12：生产 Tool 共用整个 operation 的 120 秒 deadline 与 80 MiB 输出预算；OfficeCLI 单次无活动仍以 45 秒终止。validation receipt 新增输入、runtime 输出、render 字节和墙钟资源证据。
- 2026-08-12：最终本机证据：`docs:check` 通过（337 operations / 25 groups）；聚焦测试 9 pass / 1 POSIX-host-only skip / 0 fail；package typecheck 219.7 秒零诊断；Windows x64 production-shaped package acceptance 107.4 秒通过真实 packaged OfficeCLI、四个 typed Tool、canonical Attachment、host-owned validate Part、receipt、fresh deliver、附件和 Interactive Artifact。该验收从源码测试 Harness 驱动包内 runtime，另行验证包内 OpenCorvus `--version`，不是黑盒 CLI 会话协议测试。
- 2026-08-12：旧 `office_artifact_*`、`office-artifacts`、Office 专用 lock 装配在 source/script/runtime/test/current architecture 搜索为零；冲突索引为零。最终独立复核进行中。
- 2026-08-13：不可信 PPTX/image 检查迁入独立受监督 parser 子进程；实际解压字节使用 bounded writer，递归检查 chart embedded XLSX；canonical attachment 在读取前检查上限并对实际快照复算 SHA-256。OfficeCLI LICENSE、NOTICE、THIRD-PARTY-NOTICES 进入同一 lock/manifest/archive closure。
- 2026-08-13：当前 checkpoint 证据为 Work Artifact 聚焦测试 13 pass / 0 fail、package typecheck 130.3 秒零诊断。按用户明确要求，先创建提交并 push，再执行 compiled `opencorvus.exe` 的真实完整生命周期；因此此前仅源码 Harness + packaged OfficeCLI 的证据不再作为最终 E2E 结论，最终状态保持 pending。
- 2026-08-13：主 P0 提交 `46c69afc0`、Docker 统一 lock 修复 `3cca3ff03` 及两次授权合并 `54f47b621`、`75828a8f1` 已由普通 hook 成功 push；push hook 的 8 个 package typecheck、API route、docs 与 secret scan 均通过。
- 2026-08-13：首次 hermetic compiled package 验收发现源码错误地依赖不存在的 `Bun.isStandaloneExecutable`。提交 `875244e65` 改为由 `artifactCompileDefines()` 向 `build.ts` 与 `build.local.ts` 统一注入 compile-time identity，CLI acceptance guard 与 PPTX inspector child 共同消费 `isCompiledBinaryRuntime()`；独立只读复审无未解决 finding。
- 2026-08-13：真实 pinned OfficeCLI 1.0.143 chart probe 证明 create-only part 为 `ppt/slides/charts/chart1.xml`。提交 `70eb8650d` 将白名单从推测的标准路径收敛到锁定 runtime 的真实 `ppt/slides/charts/**` 闭包，并增加正向 parser 契约；独立只读复审无未解决 finding。
- 2026-08-13：compiled acceptance 继续揭示内部 checker 错把 assistant 写入 `kind=root` Session。提交 `4958ed243` 改为合法 rootless `kind=orchestrator` conversation，按 user → assistant → validation Tool Part 的真实参与者顺序持久化，execution authority、receipt lookup 与 deliver 继续绑定同一 Session；独立只读复审无未解决 finding。
- 2026-08-13：最终从精确提交 `4958ed243` 构造隔离快照并重编译 Windows x64 包。产物为 OpenCorvus `0.0.0-main-202608121845`、OfficeCLI `1.0.143`、`phase=final`、target=`win32-x64`、5 个 Work-managed 文件。`check-work-artifact-profile --package-root` 75.1 秒通过，明确返回 `compiled_opencorvus_typed_lifecycle`、`canonical_validation_receipt`、`fresh_delivery_revalidation`；同快照完整 Work qualification 为 15 pass / 0 fail，package typecheck 零诊断。
- 2026-08-13：最终 compiled package acceptance 是组合的 production-shaped package checker：包内 `opencorvus.exe` 实际运行 typed author/inspect/validate/deliver、canonical Attachment、host-owned Tool Part、receipt 与 fresh revalidation；包内 OfficeCLI 同时执行真实 create/validate/issues/render。它不是面向最终用户的公开 CLI 会话协议测试。
- 2026-08-13：E2E 之后远端已前进到 `984d94c38`。提交实施记录前，当前分支相对 `origin/main` 为 ahead 5 / behind 7；完整待推集合除本任务 `875244e65`、`70eb8650d`、`4958ed243` 外，还夹有并行任务 `5c4dd566f`、`6ce13a351`。按仓库规则不自动 merge、rebase 或 force push，也不能替其他任务判断可交付性；这些提交与本实施记录 follow-up 提交须在远端和并行任务安全收敛后再 push。
