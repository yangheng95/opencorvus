# 文件草稿确认的路径证据

## 基线

- [真实确认打开时对应的草稿文件](baseline-confirmation-open-en.png)
- [退出动画期间显示新目标的错误路径](baseline-confirmation-retargeted-on-dismiss.png)
- [关闭后的稳定参考文件](baseline-reference-after-dismiss.png)

三张图从 `40252/ui/` 的隔离 Windows Chrome 真实操作采集并人工复核。当前提示原本正确显示 `topics/source.md`，放弃后退场帧错误显示 `topics/reference.md`。稳定目标读取正确。实际接口读取两份原件均为 200，正文与 104 字节及 83 字节的各自文件一致。
