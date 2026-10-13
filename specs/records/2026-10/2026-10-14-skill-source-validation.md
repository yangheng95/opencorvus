# 第17批：本地 Skill 来源目录校验

## Recall

- 用户要求持续逐批调查 UI（User Interface，用户界面）、功能与缺陷，先落盘根因和影响分析，再实施、真实桌面交互、原截图人工复核、聚焦正向测试、必要的已授权 GPT-6.1 Sol 验收、范围清晰提交、上游合并与正常推送，自主进入下一批。最新指令停止全部子 agent，由 Root 自己做并验收；本批不委托。
- 本批对象是第16批真实 POST `/skill/install` 的500：缺失路径的原 request ID 为 `61c5f82a-24be-43f7-b070-412fc56d6546`。该批已交付UI短摘要和可展开原诊断，并明确未修后端目录错误。
- 验收：真实本地文件系统输入的缺失目录、普通文件、空目录分别得到400、明确类型/原因/路径/消息；有效Skill及目录链接通过同一个生产安装入口得到200并可从真实目录投影读回。实际后台开发服务 `/ui` 提交无效及有效来源，中英原截图人工复核。类型/文档检查和聚焦正向测试通过；不新增、修改、运行UI自动化测试。
- 已读：仓库用户提供的 AGENTS.md，当前架构 `04-extensions.md` Skill来源全局配置/项目输入边界、`07-panel-reactivity.md` 资源反馈合同，`03-control.md` HTTP入口；第16批记录、原截图/日志与正常交付回执。工具技能 computer-use、benchmark-debug-template 已在连续任务中读取；不重新委托。
- 全仓搜索：`SkillManager.install` 两个生产调用均为HTTP routes，另有config继承、来源trust、远程缓存正向测试。全局 `/global/skill/install` 只接受git/url；项目 `/skill/install` 接受path/url/git。`validateSkillDirectory` 共用在3个来源安装、配置重名检查、已发布替换校验、替换前目标与staging校验；`listSkillNamesInDir`只有定义，无调用，属于触及范围的既存死代码，本批不扩大清理。
- 无调度、唤醒、终态或重启异常证据；本批读取了替换恢复消费者以确定错误分类边界，未观察到其运行失败。若实际出现此类故障，须立即另行横向审计Task/Mission/Session全部入口。
- 第16批范围提交 `038e323d63416a9fb00a7776dcefa51e17c487ce`；本任务正常push返回0、远端精确读回该提交，原件在该批scratch，将在本批artifact承接。共享工作区存在其他用户任务修改，保留其源/索引，不创建branch或worktree。

## 根因与影响分析（实施前）

1. 现象与触发：在真实资源页提交不存在的本地目录；UI收到匿名500，原后台日志定位到manager校验入口。普通文件和无SKILL.md目录的实际前置资格本批仍待运行，不预称已复现。
2. 数据/控制流：项目路由校验InstallInput后直接调用 `SkillManager.install` → catalog/source共享锁 → `installResolved(path)` → `validateSkillDirectory` → `Filesystem.isDir`。该utility对所有stat失败返回false，validator随后抛普通Error；serverErrorResponse映射为UnknownError500。目录为空也抛普通Error。配置patch在校验之后，错误尚未接受写入。
3. 未根治原因：第16批仅处理用户可见摘要/原始诊断。已有 `SkillInvalidError` 不限于用户来源，还用于内置包、身份冲突与恢复读取；全局把它改400会把内部完整性故障归咎于输入。共享validator也检查已经发布的替换与staging，不允许为解决一个入口而改变全部调用的HTTP语义。
4. 单一实现方案：共享validator使用async stat（跟随目录符号链接，延续旧契约），只识别ENOENT/ENOTDIR与明确非目录、空目录，抛一个内部具名Error子类承载path/reason/message；其他IO失败原样抛出。同一个validator在本地path安装的紧邻调用点，仅把此内部类型转换为新增 `SkillLocalSourceError`；全局HTTP错误表仅该精确类型400。git/url、解析frontmatter、配置重名与恢复调用不做转换，不增加旁路/重复预校验/字符串匹配。公共数据为path、reason、message三字段，reason为missing_directory/not_directory/empty_directory。
5. 公开契约：项目安装OpenAPI声明400含既有schema输入错误及新错误。SDK及API文档由当前正式生成器生成，审查实际增量，禁止手改生成结构造成双源。全局git/url路由输入不变，若生成器带入其他任务未提交合同，不能纳入本批范围。
6. 相关数据/文档：不迁移数据库、配置或Skill字节；有效来源仍写唯一全局skills.paths并刷新现有发现状态。当前架构扩展章节补充错误边界，CHANGELOG同一未发布版本双语增量。不更改版本、Release、tag或官网。全局README、月度README、artifact README同步索引，运行package.json当前docs:check。
7. 测试与风险：新增纯后端正向文件系统/生产路由测试，验证明确400及200输出/投影，包含目录junction接受。共享替换相关现有测试须先审读，发现负向断言则不保留该触及测试。实际Windows权限拒绝并非已构造，本批不能宣称EACCES端到端通过；代码分支审查与未满足范围分开记录。目录读取与扫描之间仍存在外部文件变化窗口，沿现有错误路径处理，本批不新增重试或影子状态。
8. 官方依据：Node.js `fsPromises.stat`与`lstat`合同（https://nodejs.org/api/fs.html#fspromisesstatpath-options）；使用stat延续跟随链接的目录身份。无依赖升级，不以远端版本替代本地Bun1.4实际资格。
9. 交付：先保存当前自身文件差异与Git状态，再实现；原失败/重跑回执不覆盖。自己的隔离服务通过正常runtime settlement退出后确认端口归零，精确移除自己生成的auth/models pair。无模型/Tool/prompt行为变化，当前无需调用真实Sol；若范围变化再判断必要性。正式commit、fresh fetch/merge、完整upstream..HEAD归属检查、必要验证后正常push；不得借用其他任务推送作为本任务自己的push回执。

## 执行与资格

恢复上下文后先读本Recall，再核对下面原回执，不把计划当通过证据。

- 已实施：manager保持唯一共享validator，用async stat保留IO错误；只有path分支紧邻校验把内部结构错误转为`SkillLocalSourceError`。全局错误表只增加该精确400；没有修改已有SkillInvalidError分类、URL/git输入、恢复状态机或锁顺序。项目路由400直接复用唯一`LocalSourceError.Schema`和既有BAD_REQUEST_SCHEMA；正式SDK生成的path/reason/message完整类型、英文/中文API文档同步，生成diff仅此错误合同。
- 修前原`focused-before`与`focused-before-details`均6失败；其中4个真实无效目录得到500，但两个有效输入被我初版夹具过早删除的已注册项目干扰，返回ProjectDirectoryIntegrityError400。这是本批测试生命周期缺陷，不能当产品有效来源回归。修为全组保活一个实际Git项目后，`focused-before-lifetime`精确2通过4个500红态；生产源尚未修改。
- 首次修后`focused-after`为5通过1失败：Windows Bun1.4把普通文件下的child stat发布为ENOENT，原预期ENOTDIR不符合实际宿主。保留原日志，仅把该路径的Windows预期纠正为missing_directory；Linux等其他宿主没有执行资格。`focused-final`6通过18断言，最终完整schema落地后`focused-accepted`再次6通过18断言。没有通过隐藏错误或改API返回来满足旧预期。
- 共享消费者：`shared-recovery`正式隔离runner依次通过config-skill-recovery-lock-order（1项3断言，真实发布后恢复与并发Config writer）、remote-skill-cache-publication（2项6断言，真实HTTP流故障后重取/安装与两来源快照）、skill-source-trust-identity（1项2断言，真实来源目录投影）。这些是4项11断言，与新增6项合计10项29断言，不把重复重跑累加成更多功能。
- 真实服务：自己生成的独立Git default/A/B项目，Bun1.4源后台PID61496、18636/18637，occurrence `751d518d-2bdb-4945-b6e0-018a33e9763f`。使用正式listenWithRecoveredServerRuntime及真实`http://localhost:18636/ui`，复用第16批冻结UI静态产物；本批无前端代码修改，不伪称新UI build。仅三个虚构Provider/Auth；完整公共模型目录与其自有条目同对，0推理、0Sol。
- 桌面人工复核：原图01缺失目录400英文、02普通文件400英文、03空目录400英文、04中文短摘要/详细400、05有效Skill已加载且路径可见、06滚动后完整来源区。Root逐张查看6个原PNG，没运行UI自动化。提交错误后需要人工上滚才能看到顶部反馈，该独立UX问题仍未修复；05底部控件被viewport裁切，06补齐实际区域，未执行更新/删除。切语言经Appearance离开页面会卸载notice，不宣称同notice跨语言存活。
- 真实公开checker `public`退出0：实际HTTP三类400精确name/path/reason/message及请求ID；真实UI已安装owned-feedback以config_path投影、全局路径身份匹配；global路由path输入继续得到其既有schema400。不把内存Hono路由测试当完整端到端，页面与真实HTTP证据各自说明。
- 原SDK首轮用通用named error helper，随后审查发现data会退化为任意record，改为直接引用唯一具体Schema并重跑正式SDK generator；`sdk-final`实际0，含其正式生成类型编译。源`core-typecheck`初轮0、`core-typecheck-final`最终轮实际0。`docs-check`实际0（345 operations、26 groups）；`architecture-index`实际0（19份current文档、链接有效）。
- 物理收尾：tab14关闭，stop marker使正式runtime正常settlement；parent实际exit0、18636/18637监听0，之后精确移除自有auth.json/models.json，`physical-pair-cleanup.json`与exit.json保留。隐私checker在整对清理前只在内存收集自有假credential值，退出后完整扫描后台日志129147字节及stdout/stderr各0，再无损gzip；privacy实际0，未泄露凭据。
- 未满足/不适用：没有EACCES/磁盘失败真实资格、POSIX宿主资格、全部替换cut或真实远端git资格；没有任何证据支持宣称这些通过。仅修本地结构输入，frontmatter语义错误、远端git/url和内部完整性原错误契约保留，后续发现可独立调查。现有listSkillNamesInDir死代码未扩大删除。无版本发布、tag、Release或官网写入。
- 交付待完成：范围提交、fresh fetch/upstream merge、完整待推送集合审阅、正常push及远端精确读回。正式提交之后产生的回执由下一批原件承接，不能提前写成已完成。
