# 文件草稿确认的路径证据

## 基线

- [真实确认打开时对应的草稿文件](baseline-confirmation-open-en.png)
- [退出动画期间显示新目标的错误路径](baseline-confirmation-retargeted-on-dismiss.png)
- [关闭后的稳定参考文件](baseline-reference-after-dismiss.png)

三张图从 `40252/ui/` 的隔离 Windows Chrome 真实操作采集并人工复核。当前提示原本正确显示 `topics/source.md`，放弃后退场帧错误显示 `topics/reference.md`。稳定目标读取正确。实际接口读取两份原件均为 200，正文与 104 字节及 83 字节的各自文件一致。

## 候选

- [确认打开时的源文件](candidate-confirmation-open-en.png)、[退场继续显示原路径](candidate-confirmation-retains-source-on-dismiss.png)、[放弃后读取目标](candidate-reference-after-discard-en.png)
- [正在保存原源文件](candidate-saving-original-en.png)、[保存后继续到目标](candidate-reference-after-save-en.png)、[读回已保存的源](candidate-saved-source-zh.png)
- [中文重新加载确认](candidate-reload-confirmation-zh.png)、[选择继续编辑保留草稿](candidate-reload-cancel-keeps-draft-zh.png)、[中文重新加载退场](candidate-reload-dismissal-zh.png)、[磁盘版重新显示](candidate-reload-restores-saved-zh.png)

候选 `40254/ui/` 真实放弃时的前景确认始终指向 `topics/source.md`，包括已换到 `topics/reference.md` 加载中的画面。放弃后两个原文件字节精确匹配。保存后只增加 `x`，收到 105 字节的源文件，原参考文件仍为 83 字节。中文重载丢弃第二个自测字符，恢复同一已保存内容。各实际读取 200，正文逐字等于持久原件。专用 Chrome 已退出，开发进程 33192 与 13068 均正常关闭，`40252` 和 `40254` 已释放。
