# 第 110 批：目录检查显示可操作的错误摘要

## Recall

用户要求本人持续按批调查、先落盘根因/影响、实施、真实桌面截图人工复核、聚焦验收、范围提交与正常推送；不委托。第 109 批 `e53a35eb4` 是当前基线，开始此批时已提交并跑推送钩子。只有本批隔离 Windows 目录、服务和浏览器页；不访问 Provider 凭据、不请求模型。

已读第 109 批、07-panel 手填目录合同，`chooseWorkspaceDirectory` 两个生产调用点（打开现有工作区、匿名转命名父目录）、`AppDialogOpenOptions.onConfirm`、`finishAppDialog`、AppDialogHost 的反馈、输入重聚焦和编辑清除、`ApiError`、服务两种具名错误，以及当前 `isMissingProjectDirectoryError`。全仓查 `dialog.submit_failed` 只有共享确认错误出口；`ProjectDirectoryIntegrityError` 的前端数据解析只有当前目录丢失恢复。无需修改真实服务、公开 API（Application Programming Interface，应用接口）、SDK（Software Development Kit，软件开发工具包）和持久数据。没有本范围界面自动化测试，不新增/运行。

## 实施前实证、根因与影响

独立 39168 实页，从侧栏打开已有文件夹，在同一框分别输入本批缺失目录、实际普通文件、本 Windows 服务不支持的 POSIX（Portable Operating System Interface，可移植操作系统接口）样式 `/unsupported-posix-folder-110`。三个实际 HTTP（超文本传输协议）400 分别是 `ProjectDirectoryIntegrityError/missing`（`b14ce6bb-a279-4728-bf9c-ac2d66850e3e`）、`ProjectDirectoryIntegrityError/not-directory`（`e4c5a616-c248-473b-b54a-8d081081006f`）和 `InvalidDirectoryError/posix-path-on-windows`（`ce1bc7ca-fcc1-4be8-9239-7279a276cd2c`）。三种折叠摘要都称无法确认更新，必须展开原诊断才知道如何纠正（图 01–03）。中文重复缺失目录也只说「未能确认保存结果」（图 04）。错误没有造成项目切换，原输入、焦点、详情和当前项目均保留；这批只纠正含义和可见性。

直接根因是目录确认走原异步确认生命周期，catch 无条件投影保存文案，丢弃前端主反馈可使用的原错误类型和原因；真实错误仍完整藏在 Details。第 109 批解决何时发布有效目录，保留原通用错误面，未改文案。目录丢失恢复已按 400/具名结构/目录身份处理 `missing`，新摘要复用该结构化读取以避免同一错误的第二解析。传输失败没有真实目录事实，不能根据英文栈、错误状态码或子字符串猜测缺失原因。

影响限同一手填确认的错误摘要以及共享 AppDialog 现 catch 的可选来源；其它已有异步确认继续使用原默认文案和诊断。既有领域错误、项目作用域、目录读取、焦点、取消、重试、检查失败保留输入、晚发目录丢失恢复、写入与任务终态均不改变。无调度、队列、唤醒、Task/Mission/Session 执行轮次、并发或终态异常实证。风险是错误分类被泛化、其它对话框误改默认摘要、旧请求反馈夺主；当前提交轮次和统一诊断仍由 AppDialog 管理，并用实际读和其它输入反馈核对。

## 方案与验收

在 AppDialog 原确认完成所有者内加入可选错误摘要函数，只在现有拥有检查成功的 catch 中使用。目录选择器把两个具名 400 类型和已知原因映射到当前语言、明确纠正步骤：缺失时检查路径或选另一个目录；普通文件应改为目录；不兼容时按服务宿主格式输入；无法取得真实目录响应时显示目录检查失败。仍展示同一实际 Details（原 cause、请求编号和响应）；无新状态、定时或另一路反馈。提取当前前端领域错误解码供摘要和缺目录恢复共用，不改变后者必须匹配实际项目身份的合同。

候选 39169 复现实页三种 400，中英文看折叠摘要、焦点、原输入和真实 Details；纠正进入自有项目并打开原文件。再用自有服务真实停止触发无法检查的文案，检查仍可取消及原项目范围；不要触及用户进程。用在线接口说明和编号配对，并用聚焦正向检查覆盖原缺目录恢复的同身份匹配。实际模型不需要；构建、类型、双语和文档检查辅助。

## 实施结果与证据

共人工复核 14 张 [真实桌面截图](../../artifacts/2026-11-09-workspace-directory-error-summary/README.md)。候选英文和中文的三个结构化拒绝都给出针对该原因的纠正办法；原输入、输入焦点及 Details 保留。展开候选缺目录诊断可见同一实际 400 请求编号 `27bb4c81-2d7e-4590-9535-71714c4af80d`。中文改用真实 `target-after` 后，资源管理器键盘打开 `note.txt`，编辑器显示该目录原有内容。

候选服务按自己的关闭接口退出（真实 `POST /shutdown` 200 `c5705a6e-d4c2-49a8-8b1f-ffbc61b5a7e1`）。随后在同一页提交一个存在的目录，显示「无法检查此目录。请重试。」并保留输入焦点；Details 显示浏览器 `TypeError: Failed to fetch`。取消后 `target-after` 与刚打开的原文件继续可见，焦点回到创建项目按钮。两个开发服务均正常退出且没有留下监听。

[实际目录合同](../../artifacts/2026-11-09-workspace-directory-error-summary/after-directory-contract.json) 验证在线接口说明、五个目录检查和两次同一项目列表；[服务与持久化对账](../../artifacts/2026-11-09-workspace-directory-error-summary/owned-feedback-audit.json) 配对 11 个页面目录请求和 7 个独立检查请求、关闭请求、两套文件原始字节及 Git 提交。仅成功确认后新增一个项目，两个隔离库的对话、消息、任务和模型活动均为零。Overlay 聚焦目录恢复检查 1/1、类型检查、构建、双语键检查（2992）以及文档和架构索引检查通过。服务宿主为 Windows；Windows 路径对另一种宿主的反向错误有共享结构映射，但未在另一种宿主现场验证。无模型端到端执行：此合同不调用模型。
