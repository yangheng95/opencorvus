# 历史文件夹引用的桌面验证

真实 Windows Chrome 访问隔离项目开发服务 `40038/ui/`。同一会话持久化命令中的本地目录及显式目录索引。

- [本地目录卡片只有无效的 Download](baseline-folder-download.png)
- [显式索引被展开为内部 JSON](baseline-manifest-json.png)
- [正常资源管理器手动展开真实文件夹](baseline-manual-folder.png)
- [真实公开会话、清单原件和目录列表](baseline-runtime.json)

最终开发服务 `40042/ui/` 读取基线保存的会话。两份隔离数据库的会话、消息和部件全行一致。

- [英文并排卡片](final-english-cards.png) 和 [嵌套目录展开](final-english-nested.png)
- [项目根目录与搜索焦点](candidate-root-explorer.png)
- [目录缺失时的原位置反馈](candidate-folder-missing.png) 和 [恢复后重试](final-zh-folder-recovered.png)
- [简体中文卡片、下载清单与项目范围反馈](final-zh-cards.png)
- [简体中文打开操作的键盘焦点](final-zh-command-keyboard-focus.png)、[空格打开目录](final-zh-command-explorer.png)、[方向键定位文件](final-zh-child-keyboard.png) 和 [回车打开文件](final-zh-file-workbench.png)
- [已存清单进入同一目录](final-zh-stored-explorer.png) 和 [后发搜索保留输入焦点及实际结果](final-zh-manual-search-priority.png)
- [真实列表、文件、搜索、下载和持久读取记录](candidate-runtime.json)

所有截图已逐张人工复核。英文并排卡片的间距在初次实拍后调整，重新构建并确认新版页面。两次真实清单下载均为 `notes archive.json`，156 字节与旧原件完全一致。
