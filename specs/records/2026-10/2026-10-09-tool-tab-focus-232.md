# 232 工具标签键盘与关闭焦点

[实施前Recall/完整影响分析](../../artifacts/2026-10-05-connection-workspace-authority/tool-tab-focus-plan-232.md)。真实关闭Browser和最后File后focus BODY；原Arrow/Enter/Space正常，inactive aria是已装Kobalte selected-only行为，未改库或新增ID映射。新增focused Tab Delete，与关闭按钮等待同一实际结果，按原canonical selection在单一reflow frame恢复剩余tab或Add；保留原File确认。main既有UI操作reporter透出其已处理Promise，错误/AbortError语义保留。

首轮after clean关闭成功，但dirty Cancel仍focus BODY，原失败保留；进一步修复FileEditorPane共享程序化Dialog取消：捕获原element/现有file身份/API authority，原close-autofocus hook仅在同资源、仍connected可见时恢复，accepted/cleanup退休intent。包含leave/reload同一owner，不造第二关闭或错误路径。

[真实before/两轮after证据](../../artifacts/2026-10-05-connection-workspace-authority/tool-tab-focus-232/README.md)：Delete Browser/最后clean File、dirty取消/丢弃/reload取消、两个Browser点击关闭other与保留地址、中文深色最后tab/Add+Enter/Escape均实际交互截图人工查看。原46bytes README完整保留，无Save。three Native/原foreground实际0、90表全行copy/最终13表逐行相同；Project属性差异完整记录，仅primary.git目录mtime。类型/两轮build/i18n2082/docs支撑源码，未运行UI自动化测试。

当前未覆盖changed-focus frame竞态、pending资源/连接更换、Tauri GUI、screen reader inactive aria和新子侧栏stream。用户23/18107未动，own66/67/68关闭，无新Provider或agent；清晰范围commit、上游merge/outgoing review与正常push，长期goal仅单agent继续。
