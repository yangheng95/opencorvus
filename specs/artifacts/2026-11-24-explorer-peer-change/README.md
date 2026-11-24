# 跨标签文件创建后的目录和搜索证据

基线使用 `41812/ui/` 与 `main-ba9hilQp.js`。三个已在线的标签页打开同一隔离项目。

- [创建页实际打开已创建的空文件](baseline-created-file-loaded.jpg)
- [创建后即时观察，另一个目录页仍是旧成员](baseline-peer-tree-awaiting-refresh.jpg)
- [创建后即时观察，现有搜索仍无匹配](baseline-peer-search-awaiting-refresh.jpg)
- [后续定时读取后，原查询显示新文件](baseline-peer-search-after-poll.jpg)

候选版使用同一隔离地址和 `main-B0ewkqE_.js`。复核了根目录、搜索、另一项目及嵌套目录，记录见[本批验收](../../records/2026-11/2026-11-24-explorer-peer-change.md#实施和复验)。

- [创建页打开根目录新文件](candidate-created-root-file.jpg)
- [已打开的同项目根目录随即显示新文件](candidate-peer-root-updated.jpg)
- [同项目原查询显示新文件](candidate-peer-search-updated.jpg)
- [另一项目的同一查询仍无匹配](candidate-other-project.jpg)
- [同项目搜索页中，查询前的 notes 保持折叠](candidate-search-folder-collapsed.jpg)
- [另一展开目录显示新建的嵌套文件](candidate-peer-expanded-folder.jpg)
- [此前保持折叠的搜索页显示嵌套文件](candidate-peer-collapsed-search.jpg)
