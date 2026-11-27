# 蜡烛图高精度数据阅读证据

对应[根因与验收记录](../../records/2026-11/2026-11-27-candlestick-price-reading.md)。

- 真实Work ses_hGkHHXrbAt2jX0bHZG35；产物art_g0VcAvx2700MSPloJfgh，由模型通过公开工具发布。六条OHLC是明确的绘图验收输入，不是真实行情或投资建议。
- 三张before原图人工查看：源close0.000018，普通/展开/交叉线显示0.00。实际原生CSV423字节保留原数值；缺陷在价格格式及最小步长。
- 10张accepted最终原图已逐张人工复核：末价/交叉线、原生独立价格与成交量轴、拖动面板/平移/缩放、英语深色和恢复中文。两张candidate是价格恢复后的旧overlay轴冲突，不计最终通过。
- native-baseline/light/dark.csv为三次真实菜单下载，ZIP保留原下载名；native-copy.csv来自原生Space触发后的实际剪贴板。四份各423字节与现生产导出一致，完整6行原值/时间/成交量保留。
- copy-feedback保留首次屏幕点击Copied但读回旧文案、后续键盘复制通过的有界事实；首次原因未知，下一批调查共享路径，本批未修改clipboard。
- verification归档观察到的7项正向数据检查、类型/构建/文档、9次精确Sol流式EOF、原句柄退出0和23文件/2300旧行保全。极端价格/无或缺失volume/重复无序时间/单根/2万根/其他主题未作新原生验收。
- 不保存凭据、完整数据库或私有请求文本，不运行UI自动化或像素评分。
