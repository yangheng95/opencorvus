# 291 Sources 跨对话阅读返回

全程单agent。真实旧238的五条MDN来源在当前页面中，切到另一项目的普通对话再返回，Sources与摘录被收起，先前阅读位置2016清空。普通Session/Mission直接clear UI state、Task仅恢复折叠偏好却清空读位；此前修好组件内重开仍无法跨上层primary边界。

将唯一UI store改为按API revision和source kind/id持有当前presentation record，Task/普通Session/Mission同一同步选择入口；50个最近对话、每类200条上限。所有现有展示读写接口使用同一record，未另建活动副本。折叠偏好沿同一localStorage持久化，key加入server URL/source kind/id；旧裸Task ID折叠偏好首次回默认，不做兼容双读写，消息/文件不改。

[Recall与完整根因](../../artifacts/2026-10-05-connection-workspace-authority/source-return-plan-291.md) / [真实前后、独立读位和保管](../../artifacts/2026-10-05-connection-workspace-authority/source-return-291/README.md)。最终18243本人实际验证：主Sources展开与2016段落跨项目返回保持，group折叠重开保持；原Side 1引用、来源与摘录展开在重开后保持，独立读位3108不覆盖Main。类型与构建通过，无UI自动化。

两原前台8628/67619 actual0、两Native0，19业务表/19生命周期及原Project文件元数据保持，所有checker结束后精确保管。实际剩余711617/648371ms，固定15分钟未改。原ResearchStudio实时子Dock/全帧Rendering、Task/Mission独立视觉、跨API/重启/满容量矩阵仍未全部验，goal active。
