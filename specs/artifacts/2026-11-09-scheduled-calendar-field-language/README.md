# 定时日期和时间本地化证据

[规格及复核](../../records/2026-11/2026-11-09-scheduled-calendar-field-language.md)。原图均取自隔离开发 `/ui` 的 1280 × 720 桌面，最终保存一份 2099 年的测试计划后暂停，没有运行。

- [01](01-before-english-native-fields.jpg)、[02](02-before-chinese-host-format.jpg)、[03](03-before-chinese-reopen-host-format.jpg)、[04](04-before-native-picker-page-capture.jpg)：英文/中文原生控件及重开；04 仅捕获页面，浏览器自带日历浮层未进入截图。
- [05](05-candidate-settings-load-failure.jpg)：最初候选的浏览器构造器导入错误。
- [06](06-final-english-calendar-and-clock-segments.jpg)、[07](07-final-english-picker.jpg)、[08](08-final-chinese-calendar-and-clock-segments.jpg)、[09](09-candidate-clock-partial-edit.jpg)：第二候选正常加载且分段随语言变化；07 显示日期表头的初值错误，09 记录键盘部分编辑。
- [10](10-accepted-initial-english-header-matches-grid.jpg)、[11](11-accepted-next-month-updates-header-and-grid.jpg)、[12](12-accepted-chinese-january-2099.jpg)、[13](13-accepted-keyboard-date-returns-focus.jpg)、[14](14-candidate-arrow-returns-to-old-month.jpg)：第三候选表头已同步；13 和 14 记录程序化改变下拉值后复用日期格造成的错误日期和移焦。
- [15](15-delivery-english-picker-initial.jpg)、[16](16-delivery-chinese-year-month-keyboard-navigation.jpg)、[17](17-delivery-keyboard-focus-january-5.jpg)：交付版英文初值、中文真实切年月和方向键进入正确日期。
- [18](18-delivery-minute-empty-before-validation.jpg)、[19](19-delivery-incomplete-time-validation.jpg)、[20](20-delivery-chinese-completed-values.jpg)、[21](21-delivery-english-same-date-and-time.jpg)：清空、当前语言反馈、补全 14:37、英语 2:37 PM 同值。
- [22](22-delivery-saved-future-schedule.jpg)、[23](23-delivery-reopen-saved-calendar.jpg)、[24](24-delivery-keyboard-crosses-month-boundary.jpg)：真实保存、暂停后重开、方向键跨月并取消。

[真实读取检查器](check-schedule-calendar.mjs)验证实际 `/doc`、未来规则、状态与运行历史；[落盘检查](audit-owned-data.py)和[结果](owned-final-check.json)确认隔离项目、修订、请求与零运行。
