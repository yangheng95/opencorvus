# 文件查找无匹配反馈证据

## 基线

- [实际定位长文件第 16001 行](baseline-final-line-match.png)
- [下一项完成后的无匹配界面](baseline-absent-after-next.png)
- [上一项完成后的无匹配界面](baseline-absent-after-previous.png)

截图由 `40260/ui/` 的真实隔离桌面操作取得并人工复核。两份项目文件读取均为 200，返回正文精确等于磁盘。长文件 1232036 字节，`FIND_SENTINEL` 的真实偏移 1232000。使用现有匹配器扫描该样本的字面查询，无匹配中位 66.88 毫秒，末尾命中中位 72.63 毫秒。扩大样本后同一数据检查仍能定位真实末尾。详细样本与影响见规格记录。

## 候选

- [原快捷键定位末行标记](candidate-final-line-match.png) · [尚未执行的新输入](candidate-unsubmitted-query.png)
- [英文下一项结果](candidate-en-no-next-match.png) · [英文上一项结果](candidate-en-no-previous-match.png) · [切换中文后的原结果](candidate-zh-retained-direction.png)
- [非法正则](candidate-zh-invalid-regexp.png) · [合法正则未找到下一项](candidate-zh-regexp-no-next.png) · [更正正则后选中末行](candidate-zh-regexp-final-match.png)
- [正则匹配横跨光标时的高亮与方向反馈](candidate-zh-match-spans-cursor.png) · [移动光标后原结果清除](candidate-zh-cursor-moved.png) · [关闭面板](candidate-zh-search-closed.png)
- [指南的独立空查询](candidate-zh-independent-search.png) · [选中第三行](candidate-zh-first-match.png) · [下一项选中第五行](candidate-zh-second-match.png) · [上一项回到第三行](candidate-zh-previous-match.png)

截图为本人手动操作 `40262/ui/` 的真实页面并逐张复核，构建入口为 `main-BAaCvWTl.js`。配套两个真实文件读取均为 200，与磁盘及基线逐字节一致。
