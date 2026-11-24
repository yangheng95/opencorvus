# 已安装专家团目录分页的桌面证据

全部截图来自真实开发服务的桌面页面。基线 `41540/ui/` 使用自有项目的 22 个项目包和五个实际内置项；英文 100%，简体中文 160%。下列原图均已人工查看。

| 基线 | 观察 |
| --- | --- |
| [英文翻页](baseline-en-package-page-down-leaves-first-focused.jpg) | 画面中的项目包已经换页，焦点仍是屏幕外的 01。 |
| [英文回车](baseline-en-enter-opens-old-package.jpg) | 实际打开旧的 Installed Review 01。 |
| [英文加载更多](baseline-en-cursor-appends-and-focuses-first-new-package.jpg) | 真游标追加 16–22，移交焦点到 Installed Review 16。 |
| [中文上翻](baseline-zh-package-page-up-leaves-last-focused.jpg) | 页面已向上，焦点还在屏幕外的 15。 |
| [中文回车](baseline-zh-last-package-open-detail.jpg) | 实际打开旧的 Installed Review 15，返回控制可见。 |
| [中文末行轮廓](baseline-zh-package-boundary-outline.jpg) | 末行获得键盘焦点，轮廓被表面边缘裁切。 |

实际按键与选中范围、偏移和行边界见[基线桌面实测](baseline-desktop-focus.json)。
