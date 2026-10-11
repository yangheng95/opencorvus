# 310 来源路径关系：结果与证据

[实施前 Recall](../source-path-plan-310.md)。2026-10-12，单 agent。

## 修复与数据资格

共享 `relativePathFrom` 按服务端绝对路径语法比较目录关系：POSIX 保留大小写及合法反斜杠，Windows 盘符和 UNC 统一分隔符、忽略大小写；根目录 `/` 保留。文件变更摘要删除独立的反斜杠替换，复用同一规则。外部资源保留绝对路径，来源身份、引用行号及后端物理路径验证未改。

`before-path-data.json` 与 `after-path-data.json` 是直接调用实际函数的输出。28 项纯路径/文件变更数据测试通过，55 个断言；不包含组件、DOM 或 UI 自动化测试。类型检查执行器 74167、构建执行器 43131 均已实际回收 exit 0；构建 48.91 秒，renderer public surface 检查通过。首次构建日志完成但原调用输出在上下文边界截断，无法恢复其句柄；确认对应进程已结束后重跑并保留可核对的实际完成回执，不将缺失句柄推断为 exit 0。构建现有大 chunk 提示仍在。

## 真实页面与来源

使用本次构建和正常开发服务 `http://localhost:18276/ui`。预检凭据 usable、完整模型目录 projected，实际模型 `gpt-6.1-sol`；不是单独 Vite。真实会话 `ses_-zUSENuedzztBSLOrGtw` 在隔离项目执行两次 read，生成真实 source-file：项目 README.md 与跨盘仓库 tool.ts。完整事实在 `live-01/canonical-current-conversations.json`。

- `01-sources.png`：真实流式回答中的两条可直接打开来源。
- `02-project-file.png`：README 打开项目编辑器，显示实际一行正文与 Save 控件。
- `03-external-file.png`：跨盘 tool.ts 打开为 Read only，实际正文第 1–12 行被选中；来源提示框保留完整路径及范围。
- `04-return-sources.png`：关闭文件面板后回到完整来源列表。

上述截图均实际呈现并由主 agent 人工复核。HTTP（Hypertext Transfer Protocol，超文本传输协议）日志记录了 `/file/content` 和 `/file/source-content` 的真实访问。6 次累计 Provider 请求全部 HTTP 200、流式、实际模型一致，`response_reader.terminal.kind=eof`；包含预检与产品正常内部请求。未创建产品子 agent。

公开 build.log 与 03-file-views.txt 仅裁去行尾空格以满足 Git 差异检查；原始构建日志与页面文本副本保留在本次私有目录。运行事实、正文及截图不变。

## 收尾与限制

自己的页 76 已关闭。Native 77620 / Host 46396 已正常退出，原服务执行器 10130 实际回收 exit 0；独立 `closure-readback.json` 核对进程身份、端口与 auth/models 配对清理，5 个本次 Native 生成文件按出生事实保管。完整脱敏 runtime 日志 gzip 保存，可解压恢复相同字节；原始私有日志保留。

Windows 真页面资格只覆盖上述正常项目内/跨盘打开路径；POSIX 大小写、根目录和反斜杠此次仅有真实函数的数据契约测试，未完成 Linux 原生页面验收。相邻 FileWorkbench 对 POSIX 反斜杠文件名的通用归一化仍待独立调查。本轮不宣称原始 Research Studio rendering 闪烁、所有来源类型或全部文件名边界已解决。持续 goal 保持 active，遵循最新单 agent 要求。
