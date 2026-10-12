# 2026-10-13 来源复制边界

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/clipboard-boundary-plan-359.md) · [证据](../../artifacts/2026-10-05-connection-workspace-authority/clipboard-boundary-359/README.md)。单agent把358复制异常复现到新标签页首次复制：Sources首次显示Copied而读回/实际粘贴旧值，同目标第二次正确；先粘贴后读取同样复现。正文复制也有同样顺序，独立MDN网站现有Copy按钮首次仍读回OpenCorvus正文，第二次正确代码。17张实际截图与成功/失败观察完整保留。

此证据排除Sources标题/行号的专属原因，但浏览器与操作工具的精确根因仍未知，普通桌面应用未获新验收。没有修改产品单writer或添加空写/重复写/权限/延时补丁。下一步继续追查宿主边界，同时保持原持续UI与功能目标；不能宣称复制已修复。

一个固定600000ms的原生开发scope实际447294ms、原handle76574 exit0；全部5张本地页和独立MDN页关闭，完整物理/输出/request收尾。原90表历史复制，当前11 Message/192 Source逐值相同、正式UI资产HTTP 200核对通过；未重新派遣成员、未新发模型请求。文档检查、范围提交和上游同步遵循当前规则，其他CI任务改动保留。
