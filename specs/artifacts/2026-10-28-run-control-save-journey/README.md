# 运行控件保存、焦点与键盘实际验收

对应[根因与方案](../../records/2026-10/2026-10-28-run-control-save-journey.md)。单代理、独立开发/ui、真实HTTP400/200、最终真实gpt-6.1-sol流式请求。17张JPEG未经编辑，均人工查看；中间发现的问题与最终结果分开记录。

- [01](01-after-rejected-save-truthful-value.jpg)：首改保存失败后真实值5与稳定焦点。
- [02](02-after-error-details.jpg)：中途展开诊断发现菜单底部溢出，尚未布局修复。
- [03](03-final-error-value-and-focus.jpg)：布局修复后的真实值与焦点。
- [04](04-final-scrollable-error-details.jpg)、[05](05-final-error-detail-tail.jpg)：有界详情及实际滚动至诊断末尾。
- [06](06-final-chinese-retry-value-and-focus.jpg)：中文失败、重试和值恢复。
- [07](07-keyboard-entry-tab-and-details.jpg)：最终构建由菜单实际键盘进入、保存失败、Tab/Enter打开详情。
- [08](08-keyboard-retry-stable-thumb.jpg)：Shift+Tab回原thumb、键盘重试；Esc回菜单。
- [09](09-chinese-native-keyboard-details.jpg)：中文完整真实键盘路径。
- [10](10-success-pending-files-and-draft.jpg)：认证与目标模型可用时，真实上传两文件与完整草稿。
- [11](11-success-save-four-stable-focus.jpg)：真实保存4、原thumb与焦点。
- [12](12-success-continued-save-three.jpg)：连续保存3，canonical配置实际为3。
- [13](13-success-restored-five.jpg)：继续键盘编辑并恢复5，4次保存全部200。
- [14](14-pdf-after-successful-config-updates.jpg)：两上传后超过144秒首次读取PDF，原件下载字节相等。
- [15](15-jpeg-after-successful-config-updates.jpg)：同一待发送JPEG实际打开。
- [16](16-before-real-attachment-confirmation.jpg)：自然用户发送前保留完整草稿和两附件。
- [17](17-real-attachment-confirmation-completed.jpg)：真实持久附件及模型回复“本次附件已收到”。

失败实例故意只复制完整模型目录，Provider缺认证而返回真实模型验证400；不能将这些照片当作认证发送证据。成功实例配对认证/目录并完成preflight，4个实际Sol请求全200和reader EOF。所有隔离服务已正常关闭并完成原生三项结算，原截止保持，页与凭据副本清退；未操作用户18571。schema9保持；成功旅程5条旧行更新已按当前记忆、租约和session合同复核，详见[data.json](data.json)。

[运行结算](runtime.json)、[数据/原件/实际请求](data.json)、[检查](checks.json)。纯UI改动以这些实际交互和截图作视觉验收；检查器只提供辅助证据。本批未全面覆盖鼠标拖拽、409回执及所有错误类型，整体产品迭代继续。
