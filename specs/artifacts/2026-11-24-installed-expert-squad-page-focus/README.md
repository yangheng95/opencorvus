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

候选 `41542/ui/` 的原始截图均经本人目视复核。缩放、视口和目录身份取自实际桌面。

| 候选 | 观察 |
| --- | --- |
| [英文筛选和提示](candidate-en-filter-toolbar.jpg) | 当前扩展包筛选和简洁的分页提示同屏。 |
| [英文已接受末项](candidate-en-current-page-boundary.jpg) | 15 保持完整聚焦，当前已接受 15 行。 |
| [英文真实续页](candidate-en-real-cursor-focuses-new-package.jpg) | Tab 后显式续页，将焦点交给首条新增 16。 |
| [英文详情](candidate-en-page-target-exact-detail.jpg) | 追加后翻到 22，回车打开准确项目包和版本。 |
| [英文唯一有效项](candidate-en-active-single-installation.jpg) | Active 仅显示 Dynamic，末边界保留焦点。 |
| [英文内置筛选](candidate-en-built-in-filter.jpg) | 五项内置筛选翻到项目生成器。 |
| [中文筛选和提示](candidate-zh-catalog-toolbar.jpg) | 160% 时能读到筛选、说明与完整项目身份。 |
| [中文末行](candidate-zh-complete-end-row-outline.jpg) | 末行轮廓完整，真续页按钮仍单独可见。 |
| [中文反向翻页](candidate-zh-page-up-current-row.jpg) | 07 的标题、作用域和物理键完整可见。 |
| [中文空格详情](candidate-zh-page-target-space-detail.jpg) | 详情、返回控制及项目选择可同屏核对。 |
| [中文原作者内容](candidate-zh-exact-authored-package-readme.jpg) | 真实 07 包的 README 与选择指引完整显示。 |

[候选焦点、范围和坐标](candidate-desktop-focus.json)、[基线正式目录与数据](baseline-catalog-proof.json)、[候选正式目录与数据](candidate-catalog-proof.json)。
