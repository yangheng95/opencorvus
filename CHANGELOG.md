# 更新日志

本文记录 OpenCorvus 从 `0.0.35beta` 开始的版本变化。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；产品版本使用 `0.0.35beta` 形式，代码元数据使用对应的 SemVer（Semantic Versioning，语义化版本）形式 `0.0.35-beta`。

## 未发布

## 0.1.22 - 2026-09-30

### Added

- 新增独立侧边对话与消息引用，文件编辑器按实际文件语言加载语法高亮。

### Changed

- Base 普通交付由任务负责人直接执行，再由独立测试方核验原始要求；来源调查与并行交付保留各自的委托工作流。
- 工具结果使用最近一次真实调用名称作为统一展开入口，移除重复嵌套的工具计数外层，改善主对话与侧边对话的间距。

### Fixed

- 修复子任务暂停等待 Mission 时仍显示运行中的问题，暂停、唤醒和重连会同步更新任务与 Mission 的活动状态。
- 改善 handoff 上下文的阅读布局，展开和收起时保留当前阅读位置。
- 修复上下文压缩检查点校验和请求预算处理，统一 Task 证据读取与根工具执行。
- 补齐电脑操作按需指南与有序动作说明，分离桌面端 MCP 载荷服务契约。
- 修正网站中文 Base 工作流元数据，使其与当前单一独立测试节点一致，恢复市场生成与 Registry 生命周期检查。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/1de814728820f3d00579e8293b26f832bf604550) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb...1de814728820f3d00579e8293b26f832bf604550)。

## 0.1.21 - 2026-09-29

### Fixed

- 修复原生安装包已生成，却在可选缓存保存或上传收尾阶段提前超时的问题；独立打包任务的基础设施时限与整次 40 分钟发布期限一致。
- 安装包传输保留原始文件并避免重复压缩，完整平台矩阵、签名更新和网站部署继续由同一发布流程验收。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/97a3a6807fe40fc045a354c17c99b256a2f0f2a8...b255ed5b6787d863b167ecc9d65cfe3fe6e8e6cb)。

## 0.1.20 - 2026-09-29

### Changed

- 调整工作区导航和用量统计的信息布局，统一常用入口、选中状态与阅读层级。

### Fixed

- JSON 和 Markdown 预览的复制、下载保留原始内容与实际文件名，不再导出用于展示的包装文本。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/97a3a6807fe40fc045a354c17c99b256a2f0f2a8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/386c280caffe4de04b38069ff0918d77ab6a5059...97a3a6807fe40fc045a354c17c99b256a2f0f2a8)。

## 0.1.19 - 2026-09-29

### Added

- 为交互产物提供复制、按实际格式下载和打开操作；代码、表格和 MCP（Model Context Protocol，模型上下文协议）应用保留真实内容与资源下载入口。

### Changed

- 重整工具调用、结构化输出与交付卡片，支持原始内容、全文展开和复制；文件名、格式与交付操作更突出。
- 统一设置、权限历史、右侧停靠区和输入栏的布局与主题；简化多层选择菜单，并保存项目内的选择。

### Fixed

- 修复环境状态跨目录残留、GitHub CLI 状态误报、二进制文件的虚假行数，以及非 Git 目录反复查询工作树的问题。
- 项目启动只读取目录状态，Git 初始化由显式操作触发；活动会话占用项目时明确报告 Git 身份变更冲突。
- 修复完成后的报告跟进与历史交付展示，保留每次执行轮次的实际文件；MCP 卡片在晚打开或断线恢复后读取最新持久化结果。
- 改进 Harbor 评测中的工作区归属、原生桥接就绪、时钟传递和失败/用量证据记录。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/386c280caffe4de04b38069ff0918d77ab6a5059) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/cca50888d07198ba68e4493ed29821eef088d170...386c280caffe4de04b38069ff0918d77ab6a5059)。

## 0.1.18 - 2026-09-29

### Fixed

- 修复电脑休眠或长时间暂停后，后端因进程心跳过期而持续拒绝多项目请求的问题。进程存活统一依据操作系统进程号与启动身份，项目关闭、重开和时间变化不会撤销仍存活进程的身份。
- 遗弃任务恢复核对原执行进程是否实际退出；已有终态结果可直接补齐投递。缺少物理身份的历史未完成记录会明确报告证据不足，保留原数据。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/cca50888d07198ba68e4493ed29821eef088d170) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9...cca50888d07198ba68e4493ed29821eef088d170)。

## 0.1.17 - 2026-09-28

### Fixed

- 修复 Bun 依赖缓存恢复/保存的收尾行为，让已完成的原生构建按既定整体期限结算，不被可选缓存操作阻断。
- 延续此前候选的完整产品改动，完成原生安装包、签名更新通道和网站的一体发布。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8...b1d01e71e7c56a62cd97baf3bb3bc11bf173fff9)。

## 0.1.16 - 2026-09-28

### Fixed

- 改善 macOS Intel 发布任务的缓存处理，为安装包完成后的上传与网站部署保留整体发布预算。
- 保留原生打包失败诊断，继续使用同一平台矩阵与发布身份校验。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/dd999804c984360146231386550c2cf17e7ab0e0...f4be7e43b3ae0c8c0afcb7d5e708e071ac5e74f8)。

## 0.1.15 - 2026-09-28

### Added

- 为专家团演化增加隔离诊断入口，固定模型目录、试验对象和测量来源，并提供完整的工具请求检查记录。

### Changed

- 演化比较保留未发布、不可用和无法判定的结果；每次试验归入明确的比较槽，推广决定重新核对当前审查证据。
- 数据分析团队把报告发布参数统一为一个结构化产物，保留来源和正式发布授权。

### Fixed

- Mission 验收与后续修正读取当前 Task 的完成、产物和审查证据，保留仍未满足的要求，避免早期摘要覆盖后续事实。
- 产物发布按包内声明的生产者权限执行；反复导入、测量别名与用量回执保留精确来源和执行身份。
- 修复 AutomationBench 时钟解析、冻结试验、评分输入和跨 Task 测量证据读取中的归属问题。记录的评测结果不作为普遍性能提升保证。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/dd999804c984360146231386550c2cf17e7ab0e0) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1...dd999804c984360146231386550c2cf17e7ab0e0)。

## 0.1.14 - 2026-09-24

### Changed

- 重新设计“关于”和“用量统计”设置页：集中展示版本与连接状态、突出周期用量总数，技术详情与快捷键仍可展开查看。
- Chat 会话输入栏不再显示项目当前专家团名称；Mission 与 Task 仍显示对应身份，引用查看入口保留。
- 将 Provider 菜单中的模型刷新明确标为“刷新 OpenCorvus 模型”，说明它需要单独配置 OpenCorvus Provider 凭据。

### Fixed

- 修复子 Agent 下拉选择器在活动更新时自动收起，并缩短进展卡片预览；完整会话仍可打开。
- 修复 Work Ledger 行操作可能误触停止任务的问题：菜单触发区保持稳定，停止 Chat、Mission 或 Task 前显示对应名称的确认对话框。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6ebed7625c8db3780652deb48e2f6329725b4aac...b9a72f4134de3a582dcf55cb09b6c1b299f8b3d1)。

## 0.1.13 - 2026-09-23

### Added

- 新增 Inspect AutomationBench 评测接入和专用专家团，使用官方场景状态与评分规则，并保留明确的运行、调用和验收证据。

### Changed

- 将待办读写、任务列表/状态/看板/计划查询、交互回应、工作区定位的 10 个工具入口合并为 4 个；Chat 工具声明从 39 项降到 33 项，Mission 从 39 项降到 34 项。
- 同步专家团作者说明、交互与接口契约，以及中英文工具迁移文档。直接引用旧工具名称或分别配置待办权限的集成需更新为新名称和参数。

### Fixed

- 桌面端启动、恢复可见和运行期间会检查正式更新通道，并自动下载及验证新版本；安装仍需确认重启。修复重复检查或安装失败后丢失已验证安装包状态，以及 Windows 安装程序启动失败时直接退出而未报告错误的问题。
- 改进 macOS 安装包失败诊断，并避免 Windows 依赖缓存的收尾步骤让已打包成功的发布任务超时。
- 新对话记住最近选择的模型，减少重复选择。
- 修复 Chat 和 Mission 的通用预置工具被额外白名单隐藏的问题；已授权的搜索、记忆、计划、定时和任务控制工具直接提供给模型，专业与扩展能力继续按需加载。
- 修复 Inspect 评测的项目配置入口、长完成摘要读取、流式活动观察、轮询时限校验和评分策略检查；同轮评测固定专家团源版本，避免后续样本读到变化中的配置。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6ebed7625c8db3780652deb48e2f6329725b4aac) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5c615ae5c84ac65348914a753c4fcbd53c2bd962...6ebed7625c8db3780652deb48e2f6329725b4aac)。

## 0.1.12 - 2026-09-22

### Changed

- 新增暖白、鼠尾草绿、雾蓝和石墨紫四套主题，覆盖工作区、设置、弹框与菜单，并支持保存偏好及内容明暗适配。
- 子 Agent 进展改为单列自然高度，由外层对话统一滚动与跟随；统一弹框、菜单和选择浮层的层级、边距与短暂开合效果，并改善截图面板与图片预览工具栏。
- 发布总时限扩展到 40 分钟，原生包、桌面更新、官网部署和最终状态汇总共享同一计时；明确触发后的无人值守执行与失败边界。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/5c615ae5c84ac65348914a753c4fcbd53c2bd962) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6817a581e55eaff616c1a731869309849f2926d8...5c615ae5c84ac65348914a753c4fcbd53c2bd962)。

## 0.1.11 - 2026-09-22

### Changed

- 重整工作区的基础组件、明暗主题、间距与图层，统一侧栏、输入区、Mission 看板、消息面板和设置页的视觉层级。
- 使用静态背景与半透明表面呈现轻盈玻璃质感，移除输入区轮播提示和持续脉冲效果。
- 设置内容统一为单栏；专家团与 Mission 技能采用列表进入详情、返回列表的交互，保留筛选与独立启用状态。
- 精简工具与来源展示，工具引用改为可展开的紧凑文本；Chat / Work 的项目范围与完整路径按需展开。
- 改善对话与专家协作的阅读布局，压缩重复边框、头像、标签和说明文字。

### Fixed

- 修正侧栏图标与文字、首页标题与输入区的对齐，以及设置详情残留的分栏边框与缩进。
- 改进发送失败和资源加载错误的内联提示，保留可展开、可复制的完整诊断信息。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6817a581e55eaff616c1a731869309849f2926d8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/8bd7c75332676b44312159210904c1ff67604cc4...6817a581e55eaff616c1a731869309849f2926d8)。

## 0.1.10 - 2026-09-21

### Fixed

- 二进制发布自动等待网站部署及公网下载清单校验；整轮共享 30 分钟期限，重试不重置计时。
- 修复 RPM 验收错误比较 Tauri 恢复后的编译文件，按实际包格式标记绑定不可变编译输入。
- 修复流式发布中止后已落盘内容漏登记的问题，重试清理覆盖本轮完整内容。
- 研究决策整合者使用普通工作者执行契约汇总研究证据，避免误进入要求 RequirementSet 输入的架构投影流程。

- 正常关闭已结算的数据库连接时允许仍被查询对象持有的已完成语句释放，重置和重建仍保留严格关闭检查。

- 修复 RPM 打包依赖在短写时重复计算整个缓冲区哈希的问题，消除随包体积平方增长的额外工作并修正备用载荷摘要；新增真实 RPM 文件安装与摘要验收。

- 修复工作者续调时只能继承旧输入的问题；可在同一会话中显式更新本轮目标选择，并同步模型上下文、工具校验和执行记录。
- 修复运行器拒绝更新工作量审查目标的问题，保留工作流、会话和前驱身份校验。
- 修正过期的协调指令，改善调度标识和消息读取错误提示。
- 修复任务控制验收把首个工作者的完成事件误当作最终验收事件的问题。
- 本地安装包的内置服务与桌面元数据统一使用产品版本，避免服务显示分支开发版本号。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/8bd7c75332676b44312159210904c1ff67604cc4) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a...8bd7c75332676b44312159210904c1ff67604cc4)。

## 0.1.9 - 2026-09-20

### Fixed

- 修复 Windows 开发服务器监听目录时，浏览器截图及任务产物发布因移动父目录而出现 `EPERM` 的问题；统一由清单原子提交确认发布，保留原有完整性、归属和清理约束。
- 修复已引用产物的清单或快照丢失后，产物目录仍错误显示完整的问题；损坏的持久引用返回明确错误，尚未提交的准备目录仍保持不可见。
- 修复 Advanced 专家团中实现、测试和界面完整性审查角色缺少 Browser MCP 能力的问题；新版本使用明确的角色授权，已有任务的冻结授权保持不变。
- 能力恢复提示根据当前实际可调用工具指向协调、提问或设置入口，区分角色授权、操作批准、认证和执行故障。
- 同步专家团生成的版本记录，修复持续集成中的生成产物不一致。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/36772e0533f65c645a0067909835aeb075fb4900...161bf0bfff0ff6deaa3e5d369f72a3ee26a5202a)。

## 0.1.8 - 2026-09-20

### Fixed

- 修复 Mission 无法使用已编写 Task 分配，以及工作者继续执行时输入与恢复责任不一致的问题。
- 保留任务的原始需求附件和来源，修复浏览器 Node 运行时存活判断与断线 MCP 会话恢复。
- 修复 Windows 启动回执、取消和超时原因在实际进程收敛前被提前报告的问题。
- 同步当前专家团版本与验收契约，避免无效哈希比较或缺少原始证据的重试被当成交付验收。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/36772e0533f65c645a0067909835aeb075fb4900) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/581feef4e29295568e908eb06b8e4964d978087f...36772e0533f65c645a0067909835aeb075fb4900)。

## 0.1.7 - 2026-09-20

### Fixed

- 修复旧格式内置专家团无法读取或更新、已安装列表出现大量 unrecognized_keys 的问题；内置团队更新到当前包，原内容保留备份，第三方自定义包按其实际契约处理。
- 修复 Windows 并发测试目录清理和共享依赖准备顺序；Linux 安装包按 DEB、RPM、AppImage 格式使用可独立核验的打包任务。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/581feef4e29295568e908eb06b8e4964d978087f) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e...581feef4e29295568e908eb06b8e4964d978087f)。

## 0.1.6 - 2026-09-19

### Fixed

- 修复 Mission 携带已上传文件或文件夹发送消息时的 `unrecognized_keys` 错误；首次发送与后续回复统一按接口契约提交附件引用。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/a6e0ae3c25ea47024b796b0661d976c8fdfcf31e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/6775a92aa80f0436fabd49f97a4380e38200b5c9...a6e0ae3c25ea47024b796b0661d976c8fdfcf31e)。

## 0.1.5 - 2026-09-19

### Fixed

- 修复重复打开 Provider（模型服务商）登录时，同一有效授权被误报为冲突；取消授权码输入时释放待处理流程，并改善真实并发冲突提示。
- 托管服务启动回执从持久化文件状态确认，修复文件通知丢失后已启动进程仍被判定启动超时的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/6775a92aa80f0436fabd49f97a4380e38200b5c9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a...6775a92aa80f0436fabd49f97a4380e38200b5c9)。

## 0.1.4 - 2026-09-19

### Added

- 官网新增按任务输入、调用模型和协作关系呈现的案例画廊，并将案例、机制与研究资料整理为中英文博客。

### Changed

- 精简首页内容，突出长程任务与专家团协作；改进协作图、导航和原有产品视觉。
- 子 agent 流式更新保持会话卡片稳定；缩紧停靠区标签间距，调整宽度后仍能看到当前选中会话。
- 原生发布与网站部署使用明确的触发选项，保持正式版安装包版本一致。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8...3010ea34c1b99fe35bf9f36840f5dfb9000f5b7a)。

## 0.1.3 - 2026-09-19

### Added

- 提供连接已有服务的 Mission、Task、Work Ledger、Question 与 Permission 命令行入口，支持结构化 JSON 输出、分页和交互回复。

### Changed

- 发布正式版 `0.1.3`，使用 stable 桌面更新通道。此前 beta 安装使用独立通道，可通过本版安装包切换到正式版。
- 改进子 agent 消息停靠区的阅读布局，弱化交接提示并隐藏无动作回执。

### Fixed

- 专家团已授权的平台基础工具直接进入初始能力面，保留 Skill 与 MCP 的按需加载；明确主目录执行与托管工作树的 `merge_back` 交付契约。
- 修复全局清理等待定时任务释放项目租约、而取消信号尚未发送所导致的循环等待。
- 修复交互测试绕过不可变 Task 归属事件的问题，以及子 agent 实时消息来源为空时的处理。
- 命令行无损传递问题回答和远端项目路径，正确输出 JSON、Ledger 游标与 Task 取消中的状态。
- Windows 构建提前检查被占用的可执行文件，准确覆盖 Cargo 实际写入路径。

### Security

- 将网站传递依赖 `devalue` 更新到 `5.9.2`，修复 GHSA-9rgm-9g3h-6x36。

### Upgrade

- 本版相对 `0.1.2-beta` 未修改数据库结构定义。更早 beta 数据库若报告 `SCHEMA_RESET_REQUIRED`，仍需按该版本边界显式处理旧数据；Provider 配置应保留。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f0d1063affc2e3bedb94fee6ce909e4b20ab9db8) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/57077bf019e5a427e6a37c6d850f926fd47a2665...f0d1063affc2e3bedb94fee6ce909e4b20ab9db8)。

## 0.1.2beta - 2026-09-18

### Fixed

- 修复 Project 删除后遗留的 Question、Permission 与内联交互失去 Task 归属并使 Work Ledger 整体返回 500；Task-root reducer、删除、重启恢复与交互写入现在使用同一不可变归属契约。
- 修复带 worker descriptor 的 Project 无法删除，以及删除后 Overlay 继续使用失效目录请求 Provider 和 Work Ledger 的问题。
- 修复 Windows 已终止进程仍被判定为活动 owner，阻塞运行时恢复与清理的问题。
- 修复 Side Dock 切换子 agent 后仍显示旧子会话的问题。
- 移除附件目录的数据库 authority marker；附件归属由当前数据库和 Project 事实直接校验，不再因重建数据库留下跨库锁。

### Upgrade and known limitations

- 本版数据库结构指纹发生变化。旧 beta 任务数据库会返回 `SCHEMA_RESET_REQUIRED`，需要显式重置后使用；这是预发布数据边界，不是保留任务数据的原地迁移。Provider 配置存放在独立配置面，应在重置时保留。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/57077bf019e5a427e6a37c6d850f926fd47a2665) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9faeb1c7ba879c94e38b25a0b2614398cc5a795b...57077bf019e5a427e6a37c6d850f926fd47a2665)。

## 0.1.1beta - 2026-09-17

### Fixed

- 修复任务委托准备失败后的执行收敛、关闭期间的任务接纳顺序和首次委托前的 Mission 验收责任绑定。
- 修复永久工具再次被搜索揭示后，能力投影重复导致后续模型步骤失败的问题。
- 修复原生包连续加载动态插件，以及工具输入进度重连和终态任务耗时显示的问题。
- 降低数据库调度证据校验的 SQL 嵌套深度，修复系统 SQLite 创建数据库时的解析栈溢出。
- 启动失败在进程及输出流收敛后保留有界诊断，首次使用检查失败时保留隔离现场。
- 修复 OAuth 回调身份探测超时后仍返回空响应时，被误判为外来服务并轮换回调地址的问题。

### Upgrade and known limitations

- 本版数据库结构指纹发生变化，旧 beta 任务数据库会返回 `SCHEMA_RESET_REQUIRED`，需要显式重置后使用。程序不会自动迁移或删除旧数据；Provider 配置应单独保留。
- 历史上出现过单次模型响应持续生成工具参数、迟迟无法结束的情况，根因仍在调查。此前候选构建通过的真实任务验收也不能证明该问题已根治。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9faeb1c7ba879c94e38b25a0b2614398cc5a795b) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/d1f974e58306ea3058e356192e2ffd2de910cafe...9faeb1c7ba879c94e38b25a0b2614398cc5a795b)。

## 0.1.0beta - 2026-09-16

本版本纳入当前运行时与专家团改进，并修复全新安装环境的 Work/Chat 创建失败，继续使用 beta 更新通道。

### Fixed

- 全局配置文件缺失、为空或只有空白时，由统一配置边界补齐默认值，修复首页创建 Work、Chat 时的 500 错误。
- 用户原始要求在任务委托与模型输入中保留真实来源，终态任务证据可按精确消息身份读取，初始消息偏移采用统一契约。
- 改进运行时恢复、消息发送回执与任务证据读取，保留当前分支的执行收敛修复。

### Changed

- Base 专家团补齐源数据发现、完整事实覆盖、执行结果和外部修改验收的提示词约束。
- 新增原生二进制首次使用检查：隔离无凭据运行目录，通过真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）创建 Work/Chat，并在重启后核对持久化会话；桌面内嵌后端和命令行包共用此检查。
- 纳入 AutomationBench 的 Harbor 运行适配与验收记录；这些记录不等同于本次发布的新模型评测结论。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/d1f974e58306ea3058e356192e2ffd2de910cafe) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5b11c32e5b5e914cfda9979b12d67c6ed1170714...d1f974e58306ea3058e356192e2ffd2de910cafe)。

## 0.0.64beta - 2026-09-11

本版本汇集 `0.0.63-beta` 之后的运行时、授权与网站改进，继续使用 beta 更新通道。

### Changed

- 初始工具列表直接暴露已授权且当前可执行的常规工具；专业扩展能力继续通过能力搜索发现，工具清单与实际授权保持一致。
- Provider（模型服务商）物理请求身份贯穿流式调用、错误记录与工作台诊断，便于追踪实际请求使用的模型。
- 网站新增中英文工作台入门指引、可下载示例、产品演示与标注为 PoC（Proof of Concept，概念验证）及 Under Construction 的论文 PDF。

### Fixed

- 修复 OAuth（开放授权）处理中活动交换的持久化与租约续期，以及设备码和浏览器授权的截止时间处理。
- 生命周期事务在读取状态前取得 SQLite 写入保留，覆盖调度、任务文件引用、完成结算及消息确认等共享路径。
- 统一文件、预览与项目目录的精确路径身份，修复 Windows 原子重命名与活动读取冲突，并等待异步日志写入完成。

### Security

- 将 `qs`、`svgo` 与 `@ai-sdk/provider-utils` 分别锁定到 `6.16.0`、`4.1.0` 与 `4.0.38`，采用上游对查询数组限额、SVG（Scalable Vector Graphics，可缩放矢量图形）清理及响应读取限额的修复；`@ai-sdk/provider` 同步到配套的 `3.0.14`，统一适配器错误类型。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/5b11c32e5b5e914cfda9979b12d67c6ed1170714) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/752d8b3d27dfc3a95ba7ef2956efd69250683fa7...5b11c32e5b5e914cfda9979b12d67c6ed1170714)。

## 0.0.63beta - 2026-09-07

本版本替代已生成二进制但网站未完成激活的 `0.0.62-beta`。旧 tag 与 Release 保持不可变；本版本在新的 source identity 上重新执行完整原生矩阵、更新清单和网站发布。数据库继续只接受当前 pre-release schema epoch，不增加历史 migration、兼容 reader 或线上注册表绕行。

### Fixed

- 修复 Evolution Lab 内容变化后仍复用旧 package revision 的生成闭包：canonical generator 现在发布新的内部 revision，并同步 payload 与 revision registry；发布工作流在取得 tag/draft owner 前执行同一 fixed-point 检查，内容不同的 immutable revision 仍由网站数据库严格拒绝。
- 修复 Worktree population 失败及命名 stale reclaim 在持有自身目录 acquisition 时调用移除、因而把自己误判为 active owner 的收敛矛盾；唯一精确 acquisition 现在原子转换为 removal ownership，并在移除后继续保护同一创建区间，真实 peer acquisition 仍优先阻止删除。
- 修复 Task 创建与转储校验混用 root Session 逻辑目录、process binding 物理目录的问题，以及 macOS `/tmp` 与 `/private/tmp` 指向同一物理根时的 process-binding 冲突；接受快照、物理执行 authority 与后续 Project relocation 各自保持单一事实来源。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/752d8b3d27dfc3a95ba7ef2956efd69250683fa7) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a...752d8b3d27dfc3a95ba7ef2956efd69250683fa7)。

## 0.0.62beta - 2026-09-06

本版本在 `0.0.61-beta` 的不可变发布基础上同步最新源码，修复干净环境的发布前检查，并重新发布完整桌面端、命令行、更新清单和公开网站。数据库继续采用当前 pre-release schema epoch：不新增历史 migration 或兼容 reader，不兼容的旧数据库需要显式重置。

### Changed

- 已知的精确能力引用可以直接分组 reveal；未知能力仍通过 Search-native 目录发现，所有授权、冻结输入和 receipt replay 约束保持不变。
- Light 专家团在不可变 package 内容中声明完整的调度、报告读取、完成、方法 Skill 与文件读取 locator；清单仍是唯一授权来源，提示词引用不会新增 grant。
- 发布工作流在原生矩阵编译前取得唯一 tag/draft owner，失败重跑只恢复同一 workflow-run/source 的发布身份，不会创建或接管另一运行的草稿。

### Fixed

- 修复 Dynamic 专家团内容与 revision 记录漂移，确保 canonical generator 在干净 runner 上保持零差异。
- 修复 Architect 与跨进程 workflow-node 测试夹具未建立真实 Task-root ingress、Orchestrator Tool occurrence 和 dispatch-lineage 顺序的问题，使 CI 验证当前数据库约束而不是旧的宽松夹具。
- 修复网站 package-tool 源码 export 解析、公开工具事实、下载页面缓存验证器和 immutable Squad 路径匹配；普通刷新会读取当前发布版本，同时内容寻址资源继续使用长期 immutable 缓存。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/22ce8838a043c3cd8c0a0107ef5cee2aa238c059...63b52453f233ba6b1eeeac6bd2eb8c7007c6af3a)。

## 0.0.61beta - 2026-09-05

这是承接此前未公开候选的版本，保留其功能并完成发布控制面的修复。

### Fixed

- 草稿发布从完整 Release inventory（发布清单）读取并校验唯一的工作流运行/源码归属；存在同一归属草稿时恢复它，刚创建的草稿采用有界可见性重试。
- 重跑同一发布继续使用既有身份，避免重复草稿和由此引起的安装包上传失败。

### Changed

- 汇入 0.0.55beta 至 0.0.60beta 已实现的渲染安全、全局对话、Light 咨询、动态团队、运行时与调度改进；对应改动在各候选记录中分别说明。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/22ce8838a043c3cd8c0a0107ef5cee2aa238c059) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/988128d4e455c099f3959818645b551bfa35dbd9...22ce8838a043c3cd8c0a0107ef5cee2aa238c059)。

## 0.0.60beta - 2026-09-05

这是未公开候选；当时原生矩阵完成，草稿可见性与重复记录问题阻断了后续发布。

### Fixed

- 将草稿发布归属查询改为可读取 draft（草稿）的完整发布清单，修复只面向公开 Release 的标签查询无法读取新草稿的问题。
- 原生产物继续绑定既有精确标签和源码，后续版本进一步修复草稿创建后的可见性与续跑。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/988128d4e455c099f3959818645b551bfa35dbd9) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e...988128d4e455c099f3959818645b551bfa35dbd9)。

## 0.0.59beta - 2026-09-05

这是未公开候选，记录 0.0.58beta 之后的运行时与调度改动；发布汇总在读取新草稿时失败。

### Changed

- Task、Mission、Session、等待与定时任务使用持久化执行轮次、精确请求归属和租约/结算记录处理接纳、唤醒、重试与恢复。
- 并行工作者的最终报告按明确消息集合批量读取；Light 咨询按分配的来源和工具预算组织调查与最终报告。

### Fixed

- 修复终态 Task 关闭尾部、等待信号、定时任务重试与信箱投递中的重复、遗漏和错误接管。
- 能力搜索公开有界覆盖范围，统一空筛选和已激活 Skill 引用的读取；Mission 完成核对精确证据与实际最终回复。

### Performance

- 等待、定时与恢复查询采用索引和有界分页/批量处理，减少随定义和历史记录增长的重复读取。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a...0a4d4180f9cbf8a9c27a8f3c67b72a7609ed466e)。

## 0.0.58beta - 2026-08-29

这是未公开候选，承接前一候选的架构与能力改进。

### Added

- 新增 Dynamic 动态专家团，按当前请求生成成员分工和工作流说明，供运行时组织工作。

### Fixed

- 原生 Overlay 打包选择工作区 source export condition（源码导出条件），修复干净 runner 无法解析 SDK、util 与 plugin 源码导出的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/fc390c86cb18f4d7ba74b3e763070c7b81ef1361...42e6d28c7cc565f2cbe00fbfb0ba1966db9eb67a)。

## 0.0.57beta - 2026-08-29

### Changed

- 将下一次原生打包候选统一为 0.0.57-beta，沿用 0.0.56beta 及其编号候选的产品功能和发布恢复改动。
- 本次版本提交集中在版本投影，没有单独增加产品功能；随后干净环境打包暴露的源码导出问题在 0.0.58beta 修复。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/fc390c86cb18f4d7ba74b3e763070c7b81ef1361) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f55fef191afd74352611da0235938a011d6d7766...fc390c86cb18f4d7ba74b3e763070c7b81ef1361)。

## 0.0.56beta.1 - 2026-08-29

### Fixed

- 改善 beta 发布的草稿与重跑处理，保留成功构建的产物并让失败阶段可恢复；更新相应版本与生成投影。
- 沿用 0.0.56beta 的功能基线，后续候选继续处理依赖与原生打包问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f55fef191afd74352611da0235938a011d6d7766) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/8691c972d18486f8c5848b869b184d9c7e6395cb...f55fef191afd74352611da0235938a011d6d7766)。

## 0.0.56beta - 2026-08-29

这是集中整合架构与能力改进的候选版本；其改动随后进入后续公开版本。

### Added

- 新增全局 Chat，支持在项目任务之外开展持续对话；新增运行时 Skill Market 与 Inspect AI benchmark（评测）接入。
- 新增 Light 轻量咨询团队，用于只读咨询、证据调查、比较和规划。

### Changed

- 统一 Task、Mission、Session、Provider、MCP、调度、持久化与桌面工作台的责任与组合边界，清理重复状态和废弃入口。
- 任务、需求、验收、产物与工具结果通过类型化事实和精确来源交接，专业能力按已授权的引用提供。

### Fixed

- 修复跨项目初始化和身份归属、原生 OpenAI 工具调用序列化、MCP 会话运行时归属，以及 Mission 验收和唤醒恢复的多个共享问题。
- 原生 SDK、util、plugin 和依赖投影与候选版本同步；安装预检使用实际打包输出。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/8691c972d18486f8c5848b869b184d9c7e6395cb) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/22832f8fb97df24a50c14145fc03bf995db54e42...8691c972d18486f8c5848b869b184d9c7e6395cb)。

## 0.0.55beta - 2026-08-25

### Added

- 官网新增可展开的长程 Mission 案例与协作关系图，呈现 DeBERTa CUDA 研究产物和 AutomationBench 的原始证据入口。

### Security

- 移除桌面渲染器暴露在 window 上的实时设置、应用与看板状态，以及明文服务密码和业务写入函数；生产代码改用类型化模块依赖。
- 清理依赖这些全局对象的调试入口，收紧渲染器可直接读写的业务边界。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/22832f8fb97df24a50c14145fc03bf995db54e42) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/b10c5ebc407b6fcefb93a44a27db6b162379c1ea...22832f8fb97df24a50c14145fc03bf995db54e42)。

## 0.0.54beta - 2026-08-25

本版本为共享 LLM 流停滞恢复增加明确上限，并修复公开网站“页面显示新版、主按钮却未绑定精确新版安装包”的下载交互；桌面端、命令行二进制和网站使用同一份 `0.0.54-beta` 发布事实。

### Changed

- LLM 首字节等待缩短为 90 秒；首字节或流式空闲超时各只重试一次，使同一停滞请求链在十分钟内以具名错误收敛，不再重复等待长超时。
- 网站下载菜单逐项显示架构、格式、当前版本和精确文件名；Windows 主按钮明确标出 EXE，避免与同架构 MSI 混淆。

### Fixed

- 修复首次标题生成在执行轮次开始后、主会话处理器启动前可能无限等待的问题；标题、项目记忆整理和提交信息生成现在统一使用共享的首字节、语义空闲与总时限契约。标题继承所属执行轮次的取消信号，项目记忆整理和提交信息生成继承各自调用方的取消信号。
- 修复浏览器不提供高熵架构提示时，Windows 主按钮仍停留在 GitHub Release 页面、却显示为直接下载的问题；当发布清单证明该平台只有一个架构时，按钮现在绑定清单排序的当前 EXE。
- 修复无法安全判定平台或架构时仍把 Release 链接包装成下载动作的问题；此时主按钮会展开当前版本的显式选择菜单。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/b10c5ebc407b6fcefb93a44a27db6b162379c1ea) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/23df4780d31336c97bfaaa2460e8747be70f0d7f...b10c5ebc407b6fcefb93a44a27db6b162379c1ea)。

## 0.0.53beta - 2026-08-24

本版本修复长时间运行任务的唤醒、活动续期与恢复终态收敛，同时恢复桌面端右侧工作区、工作台重命名和工具详情交互，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- 延迟唤醒现在公开稳定的持久化结算事实；长时间 Tool 执行会根据真实流式输出和持久化进度续期，不再被固定的绝对暂停时限误判为失活。
- 临时 Provider 诊断在进入持久化日志和错误边界前统一脱敏，避免上游请求上下文被意外记录。

### Fixed

- 修复恢复执行的 Task occurrence 在子 Session 已终止后仍无法收敛父级终态的问题。
- 修复 Overlay 右侧 Dock 的切换与新增菜单交互、Work Ledger 双击重命名，以及工具披露需要点击两次才能展开的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/23df4780d31336c97bfaaa2460e8747be70f0d7f) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/d2b6fef84c158f3e92479f15da3ecd6cb82facd1...23df4780d31336c97bfaaa2460e8747be70f0d7f)。

## 0.0.52beta - 2026-08-22

本版本收敛专家团工作流的公开投影、交付结算与独立验收权威链路，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- 公开 Market 与双语架构文档现在投影 Base 的 2 条、Advanced 的 6 条当前工作流；注册表、生成目录与详情页使用同一份当前 package 事实。
- Base、Advanced 与生成专家团模板的独立验收改为从原始要求和有限权威来源重建 action matrix，并按实体、规则与实际效果逐行核对。

### Fixed

- 修复调度器在 Agent Session 已完成、但父级尚未收到终态投递时缺少持久化结算事实的问题；协议现在公开可复核的 Session delivery settlement。
- 修复验收链在接收交付声明时可能丢失权威来源和效果证据，导致后续接受判断无法证明原始要求的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/d2b6fef84c158f3e92479f15da3ecd6cb82facd1) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/06ccca072ae3dac3522438628c8ef77176c74b93...d2b6fef84c158f3e92479f15da3ecd6cb82facd1)。

## 0.0.51beta - 2026-08-22

本版本继续修复多 Agent Harness 的调度、工具分配和外部业务系统验收质量，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- Base 与 Advanced 会先把验收标准拆成稳定编号，并按真实 Tool 能力把规划、执行和独立验收交给对应 Agent；只读 Agent 不再接收本地客户端、命令或外部状态变更。
- 对由当前政策、流程、模板或历史记录决定的批量业务操作，执行 Agent 会先冻结有限权威来源清单，再建立逐实体、逐规则、逐效果的 action matrix；Tester 会从原始要求和当前权威源独立重建并逐行核对。
- 可移植 Expert Squad 模板同步采用有限来源闭包、同效果表示证明和独立验收契约，避免新生成的专家团重复旧缺陷。

### Fixed

- 修复同一编排 Turn 内先更新 Goal、随后并行 dispatch 时，后续 Tool 会因决策身份漂移而被拒绝的问题；重启恢复继续使用持久化的同一决策集合。
- 修复运行时 prompt 标签、Prompt composition 指纹和实际 Agent/Session 归因可能不一致，导致 Provider 调用证据无法稳定复核的问题。
- 修复 `squad-sdk` 当前包字节仍声明旧 revision，以及 revision digest 读取平台相关 checkout 换行符、使 Windows 与 Linux 对同一提交生成不同基线的问题；生成器现在与 package payload 共用 UTF‑8/LF 规范字节。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/06ccca072ae3dac3522438628c8ef77176c74b93) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/a7f173cb69b488b72448ef35e5a87745bc4f6503...06ccca072ae3dac3522438628c8ef77176c74b93)。

## 0.0.50beta - 2026-08-21

本版本修复多 Agent Harness 在外部业务系统交付中的 Skill 投影与独立验收链路，并同步发布桌面端、命令行二进制和公开网站。

### Changed

- Advanced 对外部系统的变更统一绑定到 `planned-delivery` 工作流；执行变更的 Agent 不再用自己的交付物充当独立验收，Tester 会从原始要求和权威数据源重新观察结果。
- Base 同步明确：变更执行者发布的 Artifact 是交付声明，不是独立验收证据。

### Fixed

- 修复 `universal-build` 能解析 Expert Squad Skill、却不出现在 Skill mount matrix 中的双源问题；matrix 现在同时覆盖 scheduler-only 与 package-projected Agent，并标明能力由 package 还是 platform 提供。
- 修复 Advanced 外部系统任务可能直接派给通用 worker、绕过计划交付和独立测试的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/a7f173cb69b488b72448ef35e5a87745bc4f6503) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/0a6c203a320e411b16aac804db164498a9a56b97...a7f173cb69b488b72448ef35e5a87745bc4f6503)。

## 0.0.49beta - 2026-08-19

本版本把公开站与 README 的主张收敛到长程任务与自进化上，并汇总自 `0.0.48beta` 发布以来的用户可见改动。

### Added

- 落地页新增三段：**长程工作在哪里断**（跑不彻底、结果不能核对、工作流永远不会变好，各自对应真实机制）、
  **专家团组合起来**（以「从调研资料到一篇可投的论文」为案例，6 支专家团 / 33 个具名角色，另附三组已集成组合）、
  **会修订自己的专家团**（反馈修订与度量式活动两条路径，以及「没有你的确认就不安装」的边界）。
- 新增三篇双语文档：`concepts/long-horizon`、`concepts/squad-composition`、`expert-squads/evolution`。
- 双语 README 同步换主张，并新增同样的三节内容。
- 专家团组合的支数与角色数改为构建期从已发布目录解析（`squad-compositions.generated.ts`），
  文案里不再出现手抄的计数。

### Changed

- 落地页与 README 的定位从「开箱即用的多 Agent Harness」改为「面向长程任务的 Harness」。
- 内置工具数量按注册表更正为 43（此前 README 多处写作 42）。

### Fixed

- 修复 Work Ledger 行内固定项没有带上所属 Project。
- 修复 Release 标签打在派发时的分支头部而不是实际构建出的那个提交上。
- 修复 Mission 收不到自己已完成子任务的消息：两处解码用的 schema 要求存储层放在 SQL 列里的字段，
  判定永远不可能成立。
- 修复子 Agent 在多个界面里各出现一次：同一个会话的多轮执行收敛为一条记录，查找也不再返回最旧的那次。
- 修复重试被租约拖住：记录「500 毫秒后重试」却仍持有两分钟租约时，实际要等两分钟；租约现在可以提前到期。
- 修复 macOS 红绿灯按钮与窗口顶栏没有对齐。
- `artifact_publish` 的 JSON 解析错误改为报出行号、列号与出错处的原文摘录，不再报字节偏移
  —— CJK 载荷下字节偏移与作者能数的位置相差三倍。

### Removed

- 删除无人引用的落地页文案模块 `packages/web/src/content/landing.ts`。

### Performance

- Overlay 不再在每一个流式片段到达时重新推导整段会话。
- Overlay 启动包从 2.89 MB 降到 1.70 MB：七个 artifact 渲染器与代码编辑器改为按需加载。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/0a6c203a320e411b16aac804db164498a9a56b97) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d...0a6c203a320e411b16aac804db164498a9a56b97)。

## 0.0.48beta - 2026-08-19

本版本汇总自 `0.0.46beta` 发布以来的全部用户可见改动。`0.0.47beta` 发布过二进制，但没有单列条目，其改动一并计入本节。

### Added

- 落地页 hero 之下改为播放一段真实运行录屏：滚入视口才开始下载和播放，滚出即暂停，`prefers-reduced-motion` 下不自动播放，读者按过播放器后由读者说了算。它取代了原先二十张交付物截图的轮播。
- 专家团详情页可直接唤起桌面端安装（`opencorvus://expert-squad/install`），ZIP 下载降为次选路径；客户端仍会重新校验重定向、字节长度与 SHA-256，并要求显式作用域。
- Overlay 侧边栏可一键下载并安装更新，且只在确有可用更新时出现。
- Overlay 输入区的专家团选择器接入专家团市场：输入两个字符即可搜索未安装的专家团，并就地装入当前 Project。
- 进化面板可回到目标持有过的任意修订，反馈可直接修订清单。
- 编排器名册展示每个投影 worker 实际可调用的 Tool 集合。
- 关于面板写明作者与联系方式；README 与落地页 FAQ 说明运行时与桌面端都出自本仓库，底层没有第三方 agent 引擎。

### Changed

- 通用公开 `/session` 面收紧为：Mission Session 只能经 Mission 授权访问。
- 桌面更新清单改为描述本次实际构建出的平台，不再因为缺少某个平台而拒绝整个 Release。
- 进化实验室的候选作者提示词补上「一次修订如何改变行为」，此前每次修订只会在既有指令旁追加一句对冲表述，导致两个对照臂无法区分。

### Fixed

- 修复 VS Code Dark 等主题下 K 线图渲染为空白：主题把颜色写成 `color-mix()`，图表库只认旧式语法，颜色改在边界处解析回 `rgba()`。
- 修复浅色主题下终端选中色丢失强调色（同一根因，同一处解析器）。
- 修复图表导出菜单常驻展开，恢复为点击展开。
- 修复 Mission Board 侧边栏行的悬浮提示与其它导航行样式不一致。
- 修复 Overlay 只从协议信封取回 Session 身份、丢掉 Task 身份，导致 `review.stream.*` 找不到可投影的 Task。
- 修复公开站页脚的访问统计：改为按页面访问计数，删除按浏览器 opt-in 的令牌、Cookie 与同意标记，不再存任何与读者相关的东西。
- 修复手动触发的 Release 把紧凑版本号（`0.0.48beta`）原样传给打包任务，导致十个平台全部以 `Invalid OPENCORVUS_VERSION` 失败。
- 修复落地页 hero 的第二段录制永远不会播放。
- 修复更新安装失败后卡在 `DESKTOP_UPDATE_NOT_DOWNLOADED`：宿主在两条失败路径上都归还已准备好的安装包，客户端重试将重新下载。
- 修复单个构建机停滞就丢弃全部九个已完成平台、整个 Release 无从重跑的问题。
- 修复打包的 Work Artifact 验收先把助手消息置为完成再追加 Tool Part，导致 CLI 归档任务的生命周期检查失败。
- 修复仓库工具文件放在专家团授权根目录下会让生成流程抛错。
- 修复原生命令种类枚举存在手抄副本。
- 修复两个内置专家团在已发布版本号下更换了工具字节，导致站点注册表导入失败。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/10b548e8c35e0858b58292c0fa871c7d4f32fb53...ffa867ae02f9d0a1b9f6ab4cafd0432f0f2a4f5d)。

## 0.0.47beta - 2026-08-19

### Added

- 从输入栏的专家团选择器进入市场；专家团演化可查看已有版本，并通过反馈修订清单。

### Changed

- 编排器获得当前工作者真实可调用能力的投影，完善验收、产物和审查阶段的交接。
- 当时的发布流程保留成功平台的文件，并在说明中列出缺失平台；完整矩阵要求在后续发布流程中继续收敛。

### Fixed

- 修复 Mission 与其 Task 的公开会话通信、验收助手执行收敛及运行时恢复。
- 对 Linux 打包依赖安装设置有界等待和镜像重试，避免单一依赖下载无限阻塞发布。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/10b548e8c35e0858b58292c0fa871c7d4f32fb53) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9d41a3f3c02782e668efa7792014e0589db24d07...10b548e8c35e0858b58292c0fa871c7d4f32fb53)。

## 0.0.46beta - 2026-08-18

### Changed

- 官网收敛为落地页与专家团市场，统一双主题、布局和设计组件，并将旧入口重定向到当前位置。
- 恢复桌面更新入口与侧栏操作，统一模型搜索和 Provider 选择。

### Fixed

- 改善 Task 恢复、运行时故障和专家团演化的责任边界；修复上下文压缩与产物因果关系、工作树会话归属和共享数据库启动。
- 修复重复项目删除、Mission 唤醒来源投影及破坏性操作的交互处理。
- 修复任务流切换、启动页任务布局、子 agent 停靠区实时跟随，以及稀疏 K 线首次插入不可见的问题。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9d41a3f3c02782e668efa7792014e0589db24d07) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/df953b97cc96c43dcff96114fb826176ea9bf2cd...9d41a3f3c02782e668efa7792014e0589db24d07)。

## 0.0.45beta - 2026-08-15

### Changed

- 执行状态以不可变运行事实为依据，统一任务决策、接纳、取消和关闭的责任边界。

### Fixed

- 修复 Task 根执行的多步骤回复、决策修正、并行接纳、无动作暂停与信箱重放的收敛。
- 修复 Task 向 Mission 发布、项目删除与数据库约束、权限继续执行中的故障处理。
- 网站部署等待实际就绪后再结算，避免服务尚未可用便报告部署完成。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/df953b97cc96c43dcff96114fb826176ea9bf2cd) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e...df953b97cc96c43dcff96114fb826176ea9bf2cd)。

## 0.0.44beta.1 - 2026-08-15

### Fixed

- 隔离 OfficeCLI 的打包启动检查，修复原生包验收受宿主办公工具环境干扰的问题；检查仍针对实际随包运行时。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/f2d4e0dc0a4808972641eb43c65f3d9c77a7130e) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/9392dee6db6d9721dcbc174f80c5bc385883bb84...f2d4e0dc0a4808972641eb43c65f3d9c77a7130e)。

## 0.0.44beta - 2026-08-15

### Changed

- 默认启用浏览器和电脑操作能力，实际调用仍受角色授权与操作权限约束。
- 会话显示当前公开提示词消息，便于检查模型获得的真实上下文。

### Fixed

- 修复已提交请求决策、取消、项目删除、Mission 关闭和记忆订阅的归属与结算。
- 引用文件保留在右侧停靠区，修复被替代的 Mission 发送请求和命令截止时间原因的展示。
- 原生归档按精确源码/产物身份完成，打包与单元检查采用各自清晰的执行边界。

### 记录依据

- [版本源码](https://github.com/yangheng95/opencorvus/tree/9392dee6db6d9721dcbc174f80c5bc385883bb84) · [本版提交记录](https://github.com/yangheng95/opencorvus/compare/5a0f972b1dde004b64572c877caa2f973de82062...9392dee6db6d9721dcbc174f80c5bc385883bb84)。

## 0.0.38beta - 2026-08-09

### Added

- 增加 Provider 错误凭据脱敏契约，防止 API Key 和 Bearer Token 进入诊断消息与响应正文。

### Changed

- 将 workspace 的 Bun 类型依赖和独立决策站点的包管理器规范统一到 Bun `1.3.14`，重新生成依赖锁定结果并移除旧 Bun 类型 package。
- 退役旧 benchmark 执行树及其专用测试与 CI job，把仍在使用的浏览器停滞检测迁移到当前脚本路径，并保留 Host MCP（Model Context Protocol，模型上下文协议）的真实连接统计契约。

## 0.0.37beta - 2026-08-08

### Added

- 增加签名桌面热更新通道，并由发布矩阵统一生成和发布跨平台更新清单。
- 建立根更新日志，并在发布流程和中英文 README 中提供唯一入口。

### Changed

- 在中英文 README 顶部加入下载入口，直接指向按平台选择桌面安装包和命令行运行时的说明。

### Fixed

- 在共享启动流程中显式初始化原生 Task 进程模式，保持命令行与桌面打包运行一致。
- 打开模型选择框时刷新模型，进入 Providers 时刷新 Provider；刷新失败写入应用日志并保留界面可用性。

## 0.0.35beta - 2026-08-07

- 本版本是更新日志的记录起点；更早版本不在此倒推补录。
