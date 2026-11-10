# 技能库来源提示的桌面证据

对应 [根因、实施方案与验收](../../records/2026-11/2026-11-10-skill-library-source-guidance.md)。原图来自真实开发模式 `/ui` 的 1280×720 桌面页面，均经手工交互与人工查看。

| 场景 | 截图 | 观察 |
| --- | --- | --- |
| 基线技能库 | [英文](baseline-en-skill-library.jpg)、[简体中文](baseline-zh-skill-library-mixed-language.jpg) | 中文市场、搜索及拖入说明混用英文；实际来源、文件标识和技能原文应保持。 |
| 基线来源字段 | [本地目录](baseline-zh-skill-library-install-form.jpg)、[远程索引](baseline-zh-url-misleading-field.jpg)、[Git 仓库](baseline-zh-git-misleading-field.jpg) | 来源实际可切换，三个不同输入却都显示同一混合示例。 |
| 首版实页 | [本地目录](draft-en-path-relative-example.jpg)、[远程索引](draft-en-remote-wordy-label.jpg) | 示例已准确分离；远程字段重复来源选项的语义，最终简化字段名称。 |
| 最终英文表单 | [本地](candidate-en-source-path.jpg)、[远程](candidate-en-source-index.jpg)、[Git](candidate-en-source-git.jpg) | 当前来源对应实际输入名称与示例。 |
| 最终中文技能库 | [市场和已安装](candidate-zh-skill-library.jpg)、[取消返回列表](candidate-zh-returned-installed-skills.jpg) | 产品文案使用当前语言，实际技能名称和原文保留。 |
| 最终中文表单 | [本地](candidate-zh-source-path.jpg)、[远程](candidate-zh-source-index.jpg)、[Git 输入焦点](candidate-zh-source-git-focused.jpg) | 三种来源各有准确示例，Tab 到真实的 Git 地址输入。 |

[实际技能读取回执](receipts.json) 只含状态、请求身份、技能数量及内置来源，不含技能正文或用户路径。
