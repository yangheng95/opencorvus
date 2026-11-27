# 地图点几何核对证据

对应[根因、方案与验收记录](../../records/2026-11/2026-11-27-map-point-geometry.md)。

- 真实Work：ses_hQGeiEEa0EmNFRdGkWL4；原生map@1：art_g0VcAqGJ200KWmDtcP57，模型通过公开工具发布。输入坐标明示为验收样本，不是销售网点或道路事实。
- before两张原生截图已人工查看：单点和多点共三个位置，原Point-only显示路径只生成一个marker，普通/展开同现。
- 实际API、原工具输入和原生菜单导出包含完整Point/MultiPoint/LineString三项。9张accepted最终截图已逐张人工复核，覆盖真实缩放/平移/展开、中英语言、深色及来源说明。candidate图只证明三点和插值错误，不当作最终通过。
- native-baseline/light/dark.geojson来自三次真实菜单下载，ZIP保留原下载文件名；native-copy/expanded-copy/paste.geojson来自实际普通/展开复制及Ctrl+V草稿粘贴，各981字节且与生产导出逐字节一致，原三项要素/坐标/属性保留。
- copy-feedback记录初次展开操作读到旧内容，后续从屏幕复制并实际粘贴通过的证据。初次原因未知，没有据此修改共享剪贴板或把失败计为通过；language-feedback与marker-facts是实际页面辅助观察，不能代替原图。
- verification包含观察到的数据测试/构建/文档、9次精确Sol流式EOF、三个原服务句柄退出0及23文件/2287旧行保护事实。未进行多边形/多线/空几何/2万要素/未命名标签/其他五主题/屏幕阅读器语音的原生验收。
- 不保存凭据、完整数据库或私有请求内容；不创建UI自动测试、像素分数或可变源码摘要验收。
