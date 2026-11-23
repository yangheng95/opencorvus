# 模型服务商内联表单的真实桌面截图

来自隔离 OpenCorvus 开发页和自有无凭据的服务商配置。原始截图为 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 点 Add 后仍在工具栏，点 Cancel 后焦点落在页面根 | [新增](baseline-en-add-leaves-focus-on-toolbar.jpg) · [取消](baseline-en-cancel-loses-inline-focus.jpg) |
| 中文 160% 回车打开编辑后焦点仍在行上，下一次 Tab 到删除按钮 | [编辑](baseline-zh-edit-form-below-viewport.jpg) · [实际下一项](baseline-zh-next-tab-reaches-delete.jpg) |

| 最终实页 | 原始截图 |
| --- | --- |
| 英文 100% 新增直接定位接口地址，取消回到 Add | [新增焦点](candidate-en-add-focuses-api.jpg) · [返回按钮](candidate-en-cancel-restores-add.jpg) |
| 英文回车编辑，输入草稿后取消，恢复原地址和原行焦点 | [草稿输入](candidate-en-edit-draft-in-focused-api-field.jpg) · [原地址](candidate-en-cancel-restores-edit-and-old-address.jpg) |
| 英文编辑入口被当前搜索移出时，取消恢复搜索输入 | [搜索继续可用](candidate-en-missing-edit-trigger-returns-to-search.jpg) |
| 中文 160% 回车编辑后实际接口地址进入视区，键盘录入合法回环地址 | [首字段](candidate-zh-edit-focuses-visible-api-address.jpg) · [待保存的地址](candidate-zh-valid-edit-ready-for-save.jpg) |
| 中文真实保存后回到编辑按钮，重新打开仍为已保存地址 | [成功保存](candidate-zh-save-restores-edit-and-updated-address.jpg) · [重新打开](candidate-zh-reopened-form-shows-persisted-address.jpg) |
| 中文使用 Tab 和回车确认取消，回到同一编辑按钮 | [键盘归焦](candidate-zh-keyboard-cancel-restores-edit-focus.jpg) |
