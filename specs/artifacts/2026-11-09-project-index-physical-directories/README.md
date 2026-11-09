# 项目搜索空目录：真实运行与桌面证据

两套自有开发服务。公开目录查询的验收来自真实接口；Explorer 当前为文件搜索，其页面只验证现有用户行为。本人查看所有下列截图。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-project-folders-visible.jpg) | 基线项目树显示物理空目录 |
| [02](02-before-expand-physical-empty-folder.jpg) | 基线展开该目录，无子文件 |
| [03](03-before-file-search-control.jpg) | 基线普通文件搜索对照 |
| [05](05-after-expand-physical-empty-folder.jpg) | 初次改后仍可展开空目录 |
| [06](06-after-file-search-preserves-native-path.jpg) | 初次改后保留普通文件搜索及项目身份 |
| [08](08-after-search-file-content-loaded.jpg) | 初次改后从实际结果打开原内容 |
| [09](09-final-nested-empty-folder-visible.jpg) | 最终并行索引的项目树仍能展开嵌套空目录 |
| [10](10-final-search-opens-real-file.jpg) | 最终并行索引的实页搜索打开正确文件并进入编辑器 |

[真实基线](baseline-file-search.json)和[最终响应](after-file-search.json)由[接口检查器](probe-file-search.mjs)验证运行时说明。[基线](before-observed.json)、[首次改后](after-observed.json)及[最终实页](final-observed.json)记录实际焦点与路径。[原型目录与规则对照](walk-proof-result.json)、[同树性能脚本](compare-native-index-performance.mjs)及[串行](serial-index-performance.json)/[最终并行](native-index-performance.json)结果记录同一批文件身份和时间。

[Windows 包内检查](packaged-index-check.json)通过实际构建复制函数、编译标识和[独立编译入口](packaged-index-entry.ts)运行原生工具；[检查脚本](check-packaged-index.ts)保存正确路径与缺工具报错。[Windows 接合点检查](junction-check.json)记录隔离目录边界。[模型目录工具隔离输出](baseline-tool-list.json)对应[真实调用探针](probe-list-tool.ts)，没有模型请求。[项目和关停审计](owned-final-check.json)记录原文件、隔离数据库和实际退出。
