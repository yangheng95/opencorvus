# 创建名称冲突的真实桌面证据

使用隔离实际开发服务 `40528/ui/`、资源 `main-BXXZyC-P.js`。公共测试目录由本批创建，原文件和目录均属于本批独立 Git（版本控制）项目。截图已人工逐张查看。

| 原图 | 实际观察 |
| --- | --- |
| [01 根目录输入已有 drafts](01-baseline-en-existing-folder-typed.jpg) | 原新建文件夹名称、目标和操作可见 |
| [02 文件夹冲突销毁原表单](02-baseline-en-folder-conflict-dismissed-input.jpg) | 正式诊断移至侧栏，焦点回 New，无法原位改名 |
| [03 实际文件夹冲突明细](03-baseline-en-folder-conflict-diagnostic.jpg) | 409 `FileConflictError`，请求 `9a5b6cdb-bd5d-4e96-a3a3-e87854ea2c6b` |
| [04 已有文件冲突销毁原表单](04-baseline-en-file-conflict-dismissed-input.jpg) | `review.txt` 的 409，详情回执为 `2bd82179-f406-479c-a989-6a750b03ac0f` |
| [05 重开新建文件输入](05-baseline-en-file-reopened-empty.jpg) | 名称字段空，只显示 `notes.md` 占位，需重新输入 |

候选实际开发入口为 `40530/ui/`，资源 `main-CqtORPlK.js`。前态和候选使用相同物理隔离目录、独立运行目录和真实 1280×720 桌面。

| 原图 | 实际观察 |
| --- | --- |
| [06 英文文件夹冲突留在原位](06-candidate-en-folder-conflict-in-place.jpg) | 目标、原输入、局部错误和输入焦点同时可见 |
| [07 英文同一表单的诊断](07-candidate-en-folder-conflict-diagnostic.jpg) | 409 原诊断和 `c52ed0bd-4bea-4278-9c96-bf0fdddaaf20` |
| [08 英文目录改正后创建](08-candidate-en-corrected-folder-created.jpg) | `drafts-next` 真实出现，目录条目已选并持焦 |
| [09 合法新文件首次提交](09-candidate-en-first-pass-file.jpg) | 从新目录直接创建 `drafts-next/first-pass.txt`，空白编辑器聚焦正文 |
| [10 中文文件冲突留在原位](10-candidate-zh-file-conflict-in-place.jpg) | `review.txt` 仍可改正，展开详情读到实际 409 `5e1985e4-4fb7-4578-b84b-5d630eaa077f` |
| [11 中文文件名改正后打开](11-candidate-zh-corrected-file-open.jpg) | `review-next.txt` 实际打开，正文空白并持焦 |
| [12 中文新文件已保存](12-candidate-zh-corrected-file-saved.jpg) | 正文与保存后的无未保存更改状态同时呈现 |
| [13 中文冲突后取消回到原入口](13-candidate-zh-conflict-cancel-focus.jpg) | 焦点回工具栏，之前成功创建的内容仍在正确位置 |

通过正式读接口对照 Git 原始内容和候选编辑器保存的实际字节。以下为候选 HTTP 200 的响应标识。

| 相对路径 | 核对值 | 请求 |
| --- | --- | --- |
| `review.txt` | 原始 35 字节 | `4b008b49-e2c1-43fd-9046-4a634e1682d9` |
| `drafts/note.txt` | 原始 31 字节 | `647385a2-d52a-425f-a3da-36ae8f49b4cb` |
| `review-next.txt` | 实际保存文本 34 字节 | `ebd8654a-f212-435a-b101-867512fdda0b` |
| `drafts-next/first-pass.txt` | 实际空文件 0 字节 | `0488ace8-34e6-4426-bf3b-1254c275a196` |
| `drafts-next` | 正式根目录唯一新文件夹 | `71258352-3790-44bf-9b90-570d34f1b559` |
