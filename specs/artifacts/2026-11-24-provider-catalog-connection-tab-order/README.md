# 公开服务商目录连接控件顺序的真实桌面截图

真实 OpenCorvus 隔离开发页，使用无凭据的正式公开目录。原始截图为 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 展开 OpenAI 后直接向前进入密钥，需要反向才能到连接 | [触发器](baseline-en-openai-disclosure-focus.jpg) · [正向 Tab](baseline-en-forward-tab-skips-connect.jpg) · [反向定位](baseline-en-connect-only-after-moving-backward.jpg) |
| 中文 160% 的 OpenAI 同样先到密钥 | [中文实际顺序](baseline-zh-first-tab-skips-account-connection.jpg) |
| 中文没有账号连接方式的 OpenRouter 正常进入独立密钥字段 | [单入口对照](baseline-zh-api-key-only-provider.jpg) |

| 候选与最终交互 | 原始截图 |
| --- | --- |
| 首个候选移入展开区域后，左侧焦点阴影被表面裁剪 | [中文首次候选](intermediate-zh-left-focus-outline-clipped.jpg) |
| 英文 100% 展开 OpenAI，首次 Tab 到 Connect，第二次到密钥 | [第一个控件](final-en-first-tab-connect-with-focus-ring.jpg) · [第二个控件](final-en-second-tab-api-key.jpg) |
| 英文反向回到触发器并原位收起，自定义搜索结果仍进入原编辑动作 | [收起并保留焦点](final-en-reverse-then-collapse.jpg) · [原有自定义入口](final-en-custom-result-keeps-edit-action.jpg) |
| 中文 160% 空格展开，连接轮廓完整，后继为该服务商的密钥输入 | [完整连接轮廓](final-zh-connect-complete-focus-outline.jpg) · [第二个控件](final-zh-key-field-after-connect.jpg) |
| 中文单入口 OpenRouter 仍由展开触发器直接到其密钥输入 | [单入口](final-zh-openrouter-direct-to-key.jpg) |
