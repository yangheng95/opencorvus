# 新建和重命名的名称不能更换目录

## Recall

用户要求本人独立持续分批：在真实页面调查，先记录根因和影响，再改、桌面交互、本人看截图、聚焦正向检查、范围提交、普通合并上游并正常推送。上批 `3e3353ac9` 已推送，与上游 0/0，起始 177 条原状态一致。只操作本人新建隔离项目的文件，不读取凭据和模型目录、不发模型请求、不执行删除。

已读 [07-panel](../../current/architecture/07-panel.md) 的 New 目标合同、[新建目录焦点](2026-11-09-folder-create-focus.md)、[Windows 名称合同](2026-11-09-windows-device-basename.md)、[转移相对目的路径](2026-11-09-file-transfer-project-relative-destination.md)。全仓搜 `createEntry`、`renameItem`、`joinExplorerPath`、`contextTargetDirectory`、`createFileItem`、`moveFileItem`、`classifyEntryBasename`、`assertFileEntryName`、相关双语名称键及 AppDialog 的原始输入校验和字段错误。服务已用纯 `@opencorvus-ai/util/entry-basename` 分类名称；overlay 已声明该包、正常构建解析 source 入口并已有同包纯工具运行调用。纯名称测试、文件写入/读取检查已确认；触及路径未发现界面自动化测试。Windows 宿主名沿现规则，参考[微软文件命名规则](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)。

## 实际根因和影响

隔离 39106 `/ui` 加载 `main-DUA6HCcy.js`。在 `scope-target` 的新建文件夹确认中输入 `../sibling/wrong-folder`（01）；实际 `POST /file/item` 200 `6c19be22-ce36-4b08-9c1b-6e09db3e88a6`，物理创建到 `sibling/wrong-folder`，页面也把焦点给了那个目录（02）。把 `scope-target/rename-source.txt` 的新名称填成 `..\sibling\wrong-rename.txt`（03），真实 `PATCH` 200 `0f34997b-4b0e-4621-aaad-953162478d1a` 将原件移到 `sibling/wrong-rename.txt`（04），提示仍含原拼接的 `scope-target/../sibling`。新建文件在相同确认目录输入 `..\sibling\wrong-file.txt`（05），实际 `POST` 200 `a5ac4067-877c-4c7a-b531-9894124a0a31`，编辑器读 `GET /file/content` 200 `924af5b2-2e35-43e1-80ab-95f98e6a2c70` 打开 `sibling/wrong-file.txt`（06）。四个公开目录按实际 `/doc` 结构与完整成员核验，五个下载与磁盘/种子字节相同，新文件是 0 字节，重命名保持原内容。基线已正常关闭，进程退出 0。

直接触发是名称字段只要求非空。`createEntry` 选定目录、`renameItem` 选定原父目录，但随后把用户输入送到接受相对路径的 `joinExplorerPath`，斜线和父级进入最后写入。服务创建/移动接收项目相对路径，`basenameForEntry` 校验其中最后一项，而真实父路径仍在项目内，因此服务合约允许这条路径；服务并不知道用户确认的父级。b87 只修四个 Copy/Move 目的字段，名称允许的原始输入语法不同；过去新建焦点修复只是把焦点移到真实结果，无法阻止写错确认目录。影响三种名称输入：新建文件、新建文件夹、重命名；顶栏、选定目录和背景等创建入口均沿唯一 `createEntry`，文件和目录重命名沿唯一 `renameItem`。真正跨目录移动属于现 Move/拖放，不更改。公共路由、校验、权限、文件读写、文件系统格式、调度/队列/恢复和模型均不变，无执行轮次异常证据。

## 实施与验收

在两个唯一 UI（User Interface，用户界面）函数中给原 `validateInput` 提供同一名称校验：按捕获项目的服务器路径语法调用服务已有的 `classifyEntryBasename`，输入还没和父路径拼接。空/点/含分隔符返回清晰的单名称说明；现 Windows 无效字符与保留名/末尾点空格分类返回不同本地化反馈。合法名称以原字节语义和既有父路径进入原操作，不另造词法、剥离路径或保存第二个输入；现字段留原值和焦点，编辑后错误清除。现 AppDialog 必填反馈在这些名称字段也使用同一单名称说明，Copy/Move 字段语义保持。现名称分类测试已经覆盖普通 Unicode 名、点、路径分隔符、平台字符、保留项；不新增镜像测试，不做设备名文件操作。

普通构建后隔离 39107 真实页面：英文在选中 `scope-target` 复现错误路径和普通 Windows 非法字符反馈，再在同框改为 `kept folder`；中文重命名复现错误路径，改为 `重命名 原稿.txt`；选中改名文件后用 New file 确认其父目录，复现错误路径，再改为 `新建 文件.txt` 并打开真实空文档。本人查截图和实际焦点、目录响应、真实写入/读回执、物理字节和只读数据库；若发现新问题，先补根因再改和重拍。运行现共享名称测试、聚焦文件正向检查、双语、类型、构建、文档和架构索引，无 UI 自动化。范围提交、正常上游合并、审查全部待推提交后推送。

## 最终验收

39107 `/ui` 实际载入 `main-BhzeY3M6.js`。英文新建目录输入跨目录路径、`bad:name`、`kept folder.` 时在 `Folder name` 原地保留输入和焦点，三种错误分别提示单名称、Windows 字符及末尾句点（07–09）。修正为 `kept folder` 后 `POST /file/item` 200 `7d9f4254-84e0-41c7-8eda-fc8f1e7c7ce2`，页面焦点在 `scope-target/kept folder`（10）。中文重命名同样就地反馈（11）；修正后 `PATCH` 200 `8ac1f58e-0501-456b-9d15-6212f3d276e8`，原父目录中的 `重命名 原稿.txt` 保持原 26 字节并取得焦点（12）。从选定的改名文件进入中文新建，仍确认 `scope-target`，有路径的名字就地反馈（13）；修正后 `POST` 200 `4ca9f22a-e42d-4658-af6f-761f73c80b0a`，编辑器实际读取 200 `e95190d8-63c2-46df-bfae-ea47aba5a750` 并聚焦 `scope-target/新建 文件.txt`（14）。没有进行实际设备名文件操作，未单独复验所有创建菜单入口或其它主机。

前后各四个真实公开目录按 `/doc` 校验、五个原件下载和物理字节核对，最终 `sibling` 精确只含 `anchor.txt`、空文件及空目录在确认的父目录；服务只有上述三次写入和一次编辑器读取，错误输入无附加请求。原件对照 Git，数据库项目归属匹配，任务、会话、自动执行、Provider（模型服务商）活动均为 0。两套服务正常关闭并退出 0。本人逐张复核 14 张实际截图。31 项已有共享名称契约（47 个断言）、两项聚焦运输/刷新（7 个断言）、双语 2979 键、类型、普通构建与渲染面、文档和架构索引通过。没有模型路径变更，未使用模型或凭据。[实际截图与服务证据](../../artifacts/2026-11-09-file-entry-name-parent-boundary/README.md)。
