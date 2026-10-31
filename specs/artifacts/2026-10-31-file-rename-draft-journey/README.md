# 文件重命名与草稿实测

对应[方案和根因](../../records/2026-10/2026-10-31-file-rename-draft-journey.md)。单agent操作三个独立原生开发服务的 `/ui`，均为1280×720隐藏内置页面；每张截图均实际呈现并人工查看，没有运行UI自动化测试。

最终版本修复了两个焦点断点：右键菜单到改名弹窗的触发关联，以及关闭中的改名弹窗到未保存决定的归属交接。取消直接改名、取消串联决定、取消父目录改名、取消搜索结果行改名均返回原行，可用Tab/Shift+Tab继续。未保存D仍留在编辑器时，磁盘A保持77字节；保存后文件改名所得D完整107字节。父目录改名先取消，磁盘D保持；保存后新路径E完整128字节。仅大小写改为RENAMED.TXT后，实际目录项、接口和编辑器一致；打开旧验证文件D再返回，E仍完整。

| 截图 | 实际画面与用途 |
|---|---|
| [01](01-before-explorer.png) | 基线文件工作区原目录 |
| [02](02-before-new-file.png) | 实际新建文件后的加载过程，不作为最终成功证据 |
| [03](03-before-saved-a.png) | 已保存的原文A |
| [04](04-before-rename-decision.png) | 基线确认改名进入未保存决定，初始Cancel焦点 |
| [05](05-before-cancel-preserved.png) | 基线取消后D完整保留、原文件名未变 |
| [06](06-before-cancel-tab-context.png) | 基线直接取消后的键盘上下文；焦点判断结合稳定回读记录 |
| [07](07-before-stable-cancel.png) | 基线完全关闭后仍BODY焦点的稳定状态 |
| [08](08-before-saved-rename.png) | 基线保存D并完成文件改名 |
| [09](09-after-cancel-focus.png) | 第一候选直接取消返回原行，焦点环可见 |
| [10](10-after1-draft-preserved.png) | 第一候选串联取消后草稿D仍在；该候选串联焦点尚未修复 |
| [11](11-final-chained-cancel-focus.png) | 最终串联取消返回draft.txt，可见键盘焦点环 |
| [12](12-final-cancel-draft.png) | 最终取消后D与未保存标记完整 |
| [13](13-final-parent-cancel-focus.png) | 父目录改名串联取消后返回原父目录 |
| [14](14-final-parent-saved.png) | 保存E、父目录改名后的后代编辑器 |
| [15](15-final-case-only-editor.png) | 仅大小写改名后的RENAMED.TXT与E正文 |
| [16](16-final-reopen-earlier-d.png) | 重新打开此前验证目录中的D |
| [17](17-final-reopen-e.png) | 再返回最终新路径，E完整 |
| [18](18-final-search-cancel-focus.png) | 搜索结果行取消改名后的焦点环与实际路径 |

[verification.json](verification.json)记录三次冻结版本、数据完整性、运行退出和检查结果。SQLite schema9/92表，原215948行各列完整保留，最终216584行；增量由21次本轮file.edited及其126条成功派发回执、三次运行激活等持久行组成，逐条归属本人QA目录。75附件、十三Git项目/28 tracked原文件、十三+三十九原文件及当前QA项目22原文件保持。该QA项目新增三份验证文件，Git untracked相应变化，不声称其完整status不变。

三个服务均public shutdown200，原始exec/native/launcher退出0，物理、输出、请求及OS出生身份结清；六个配对auth/models副本清退，源元数据与目录原字节保持。模型新增0、累计1118。未触碰用户18571服务或真实用户DB，未进行数据库迁移。最终前端build、typecheck、renderer public surface与docs检查通过。

范围限于实际验收的桌面文件流程；没有将MissionBoard、ImagePreview或全部共享弹窗消费者声称为重新端到端验收。所有正文为本人隔离QA输入，不提交认证或原业务全量快照。
