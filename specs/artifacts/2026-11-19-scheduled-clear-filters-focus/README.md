# 定时任务清除筛选焦点验收

## 基线

- [三个筛选同时应用，Tab 到达清除按钮](baseline-en-clear-focused.png)
- [回车恢复两条定义，搜索输入没有焦点](baseline-en-cleared-focus-lost.png)
- [直接输入新查询后，两条结果和空输入仍在](baseline-en-type-does-not-reach-search.png)
- [下一次 Tab 到第一条结果](baseline-en-tab-after-clear.png)

本人在 Windows Chrome 1280×800 视口操作并复核 `40328/ui/` 的 `main-PPcSIc8f.js`。 [两个正式定义、原未来触发和空运行历史](baseline-scheduled-filter-receipts.json)

## 候选版

- [英文组合筛选与键盘聚焦清除按钮](candidate-en-clear-focused.png)
- [键盘激活后现有搜索框接到焦点，两条结果恢复](candidate-en-search-focused-after-return.png)
- [直接输入新查询得到唯一原项目结果](candidate-en-invoice-next-query.png)
- [原项目定义的暂停状态与原提示词](candidate-en-original-paused-detail.png)
- [中文三个筛选组合与清除入口](candidate-zh-combined-empty.png)
- [鼠标清除后搜索框获得焦点和结果恢复](candidate-zh-search-focused-after-click.png)
- [直接输入新查询得到唯一全局记录](candidate-zh-warehouse-next-query.png)
- [全局记录原详情、下一次时刻和空运行历史](candidate-zh-original-active-detail.png)

本人在 Windows Chrome 1280×800 视口操作并复核 `40330/ui/` 的 `main-DNaZaGdJ.js`。 [交互后正式定义和运行记录](candidate-scheduled-filter-receipts.json)
