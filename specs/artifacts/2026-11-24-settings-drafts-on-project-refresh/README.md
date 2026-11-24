# 同项目配置刷新和未保存草稿的桌面截图

四张截图为同一隔离开发服务的独立桌面标签，均使用项目 `branch-review`。第四张停留在正在编辑的代理字段，开关为关闭。地址均是专用本机测试值。

| 页面 | 实际看到的内容 | 截图 |
| --- | --- | --- |
| 保存者 | 通道地址是 `accepted-576` | [查看](writer-saved-url.jpg) |
| 未编辑的观察者 | 页面原来留空的同一个字段自动显示 `accepted-576` | [查看](clean-channel-shows-saved-url.jpg) |
| 正在编辑通道的观察者 | 地址保持 `unsaved-576`，光标仍在地址文本末尾 | [查看](channel-draft-after-project-save.jpg) |
| 正在编辑网络的观察者 | 代理地址保持 `draft-576`，光标仍在地址文本末尾 | [查看](network-draft-after-project-save.jpg) |

核对结果与真实保存回执见[记录](../../records/2026-11/2026-11-24-settings-drafts-on-project-refresh.md)。
