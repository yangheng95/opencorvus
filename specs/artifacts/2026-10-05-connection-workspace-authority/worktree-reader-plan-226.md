# 226 工作树事实读取

## Recall

用户要求持续自主体验、修复功能/UI（User Interface，用户界面）及Sources问题，最新明确只用单agent。225已推送f00c5915，当前git status干净。上一轮真实Environment主分支/变更计数已可读，但GET /project/current/worktrees返回ProviderModelNotFoundError400；点击branch另有transformCallback错误。两项原截图完整保留，本轮先修实际工作树读者，原生菜单跨host契约与computer MCP（Model Context Protocol，模型上下文协议）500继续独立调查，不能称整个Environment完成。

已读225Recall/实际截图/HTTP（Hypertext Transfer Protocol，超文本传输协议）事实、05-config/07-panel架构，server精确Project context分类及中间件，ProjectRoutes的读取/删除/cleanup/initGit，Worktree.listProjectWorktrees/listRegisteredWorktrees/parseWorktreeList及全部调用点、ProjectWorktreeInfo/List公开协议、error handler、UI syncWorktrees/loadProjectWorktrees和重试归属、现有正向测试与history完整复制/Native终态工具。全仓生产/测试和架构相关定义/调用搜索：列表只读Git registry和当前prompt占用，输出name/branch/directory/status/removable，不包含Task/Session执行身份；route旧description与实际schema不一致。

验收：缺少可执行模型时，真实HTTP入口能返回primary和managed工作树的精确Git事实；真实锁定/解锁后的removable正确更新，同Project及两Project串并读隔离；非Git明确412，缺directory明确400，DELETE仍保留完整runtime模型错误。当前协议字段不扩展、不合成Task/来源。真实开发serve /ui的Environment工作树区及原中文Sources截图人工复核。禁止UI自动化测试；纯后端正向行为测试可以执行。

## 修改前分析

现象/触发：真实225页面每3秒重试工作树列表都400，main Git事实已正确。直接原因是精确GET工作树读者尚未列入现有PROJECT_IDENTITY_ROUTE_KEYS；中间件Instance.provide(init=InstanceBootstrap)在调用Worktree前先要求配置模型投影，当前完整历史副本有原model选择但没有模型目录，抛原typed400。225仅改三个VCS（Version Control System，版本控制系统）GET与物理branch读取，未覆盖独立Project worktree路由，因此不根治此入口。并非授权auth失效，不借此复制凭据或补虚假模型。

数据/控制流：Worktree.listProjectWorktrees使用现有Instance.directory/worktree检查Git，listRegisteredWorktrees通过真实hostGit读porcelain，按现有ProjectRuntimePaths过滤primary/managed目录，并读取当前SessionPromptState占用计算removable。原Project ID参数目前不参与列表计算，不能在本轮无需求扩展或另造事实来源。GET不启动模型、Watcher、Task或mutation。删除/cleanup涉及不同能力和真实执行约束，精确GET分类不会改变它们。

共享机制横审：全部listRegisteredWorktrees调用复用按path.resolve(primaryDir)键的in-flight请求，并在finally仅删除同一Promise；结果每调用复制条目，解析真实registry。UI重试保持authority/selectionEpoch/requestGeneration所有权，关闭/切Project取消原计时。原Native真正exited0且13表逐行相等，未发现Task/Mission/Session执行轮次、唤醒/恢复/并发或终态异常；不是以偶发降级。测试覆盖热锁事实、linked目录以及不同Project串并读，若出现共享异常立即扩横审。

定义/公开合同/数据风险：只把GET /project/current/worktrees纳入现有identity分类，继续同一个Worktree实现；DELETE及其他Project route保留原runtime。修正公开列表description和目录/非Git错误descriptor，SDK（Software Development Kit，软件开发工具包）及中英文API文档由当前generator生成。现有服务path/公开严格schema/删除eligibility与不可逆确认不改，不新增缓存、fallback（后备路径）、旁路或兼容实现。无需迁移数据库，无版本/发布变更。真实Git状态/所有权可能在读后改变，删除仍需原实时校验，不能把removable投影当删除授权。

## 实施与验证计划

先增加聚焦正向HTTP测试并保留原400失败，再改唯一分类/公开metadata。临时Git branch/worktree仅由测试在managed scratch目录创建；不在用户仓库创建额外branch/worktree。明确DirectoryRequiredError/WorktreeNotGitError、实际primary/managed/locked输出和DELETE模型错误，聚焦后端原VCS合同与context测试、SDK生成/core types/docs检查。禁止DOM（Document Object Model，文档对象模型）、组件、快照、浏览器fixture、源码文案或像素断言。

真实页面复用原222before完整自然Source历史，fresh只读guard/所有启动前沿/原birth/port/pair闭合后全90表逐行相等复制，保留原Project/directory/Session；目标worktree-reader-226-after-01/18153固定900000ms Native截止，无auth/models、模型请求或历史Task重启。使用当前正常开发serve /ui，复用已验前端asset；Environment工作树和原来源文件真实操作/截图人工查看。自身页关闭、sole shutdown、原foreground/Native实际0/fullphysical-output-request、最终13表完整行与原两个Project文件核对。自己出生的生成文件仅在全部检查/观察结束后逐文件归档。用户IAB23和进程不动。

spec索引/目录README/月记录同步，当前docs:check；精确范围Git提交，fetch/merge上游、待推送提交集合复核及正常push。持续goal保持active，原分支交互/MCP和Source其他矩阵未达成项如实保留。

## 修改前实际入口证据

新增4项实际HTTP/Git正向检查，原baseline进程自然退出1：两项实际primary/managed及并行独立Project读取均在Worktree执行前收到精确missing-worktree-reader/model的ProviderModelNotFoundError400。非Git412/缺directory400及DELETE原模型400两项通过。原输出/process/exit保留。完成分析和证据后才修改唯一GET分类；没有改listRegisteredWorktrees、状态缓存、占用owner或UI重试机制。

首次修复后19例17pass/2fail，实际读者已200，差异为Git porcelain路径的规范正斜杠与测试fs.realpath的Windows反斜杠。现有公开Git路径投影保持，测试期望按当前真实Git路径表达精确目录身份；没有修改生产数据或将错误吞掉。首次原输出保留，重新执行原完整聚焦验收。

## 当前收敛与继续项

[实际证据](worktree-reader-226/README.md)及[月记录](../../records/2026-10/2026-10-09-worktree-reader-226.md)。最终19pass/0fail/55expect、core types/SDK/docs通过，真实中英文Environment单primary投影和中文Source打开原正文人工通过。页面实际工作树请求completed200；没有managed工作树分类，多managed视觉矩阵仍待后续真实资料，不能用测试代替。

自身IAB48关闭，exec7136/Native实际0/fullphysical-output-request与独立闭合完成，最终13表全行相等、两个Project无增删内容，主Project仅.git目录mtime变化。5个当前Native出生文件在全部工具/观察终态后逐文件归档。分支菜单和MCP错误继续，持续goal不标complete。正常提交/上游合并检查/推送后进入下一轮。
