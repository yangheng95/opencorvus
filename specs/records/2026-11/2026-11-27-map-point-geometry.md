# 地图点几何的真实显示核对

## Recall

- 用户要求本人持续批次体验和调查，先根因/影响分析落盘，再真实修复、原生桌面页面交互和截图人工复核、聚焦正向非UI（User Interface，用户界面）测试、精确openai/gpt-6.1-sol流式端到端验收、范围提交/最新上游普通合并/正常推送后继续。无子代理/额外线程/分支/工作树/发布/tag/PR；现配对凭据和完整模型目录已授权，请求不限，不刷新或泄漏。
- 上批时间线键盘及库数据形状修复02744f0c2e1ba460f46e7414023f11b2d2672d4a已完成；原push54575明确join退出0，实际远端/上游/本地一致0/0，暂存空、原177项无关状态保持。23文件/2287旧行保护通过，run84–87全部8请求流式EOF、服务退出0及配对副本退役，自有页面关闭。不重做已交付时间线/Notebook/Network等修复。
- 已读唯一MapArtifact全部实现、当前地图架构/单一basemap配置、地图CSS/共享ArtifactFrame、artifact-export原GeoJSON导出、canonical schema与生产提示片段、theme palette、相关历史记录。全仓搜索发现schema明确接受Point/MultiPoint/LineString/MultiLineString/Polygon/MultiPolygon，只有唯一MapArtifact创建地图；坐标递归bounds覆盖全部，但renderMarkers仅处理Point，fill/line层亦不绘制点。此为代码线索，尚未冒称真实复现。
- 2026-09历史MapLibre 6.4.1安全修复及鉴权阻塞记录已读；现地图worker/basemap/attribution公共契约不得绕过。2026-10父页面绘制隔离审计只证明宿主归属，未证明多点渲染。当前模型已获授权但须重新分别验证凭据可用、目录投影和实际精确请求。
- 已查[MapLibre Marker公开接口](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/)；现Point已使用Marker/setLngLat/addTo及清理。优先复用现原生路径，不引入第二地图、远程数据、发布绕行或修改作者GeoJSON。具体修复仍待原生现象/共享影响分析完成。
- 继续computer-use与benchmark-debug-template技能，自有开发服务的/ui/及隔离Chrome；无UI自动化。当前未发现调度/队列/恢复/并发/终态异常，不能从地图几何缺项推断执行器故障。

## 本批输入、成功标准及调查步骤

1. 新保护基线复制上一正常退出run87的项目事实；启动run88的当前开发包，配对凭据/完整目录/精确模型分别预检，180秒真实无字节活动超时。记录实际23文件、旧行和样本Git，不猜计数。
2. 原生向Work提交地图核对任务：使用明示的验收样本坐标，非销售网点或真实路线事实；包含一个单点、一个含两个坐标的MultiPoint和连接这些坐标的线条。模型通过现公开工具自然发布真实消息所属map@1，保留实际输入/结果/持久产物身份，不人工插入或改写消息、产物、数据库。
3. 在真实页面查看标记/线条、原生缩放/平移/展开/关闭和语言主题；实际下载GeoJSON，与原发布全部几何/坐标/属性逐值核对。只读DOM/无障碍树可辅助定位，截图人工复核才证明可见结果。
4. 如证实缺口，实施前补现象、触发、数据流根因、旧路径遗漏原因、全部入口/类型/调用/文档/交付影响与风险。修复仅依赖已证根因，不能只改样本数据为Point来遮蔽MultiPoint。
5. 如提取纯数据投影，增加聚焦正向输出合同测试；UI部分只用实际交互/原图。新bundle/新服务复跑原路径，双语主题和完整原GeoJSON导出验收；当前未覆盖的场景明确列出。
6. 排空请求、join原始服务句柄、配对副本退役/关闭自有页面、保护旧数据；文档和索引检查、清晰提交、fresh fetch/merge、完整待推提交集合审查、普通push并join和实际远端核验，然后进入下一批。

本记录是实施前调查方案，当前尚无地图修复或原生通过结论。

## 已证根因、共享影响和实施方案

- run88三项Provider预检分别通过；原生页面提交后的真实Work为ses_hQGeiEEa0EmNFRdGkWL4，publish_interactive_artifact调用prt_g0VcAqFB300JUIQ5FX8S完成，产物art_g0VcAqGJ200KWmDtcP57。实际API、原工具输入和真实菜单下载981字节均保持给定三项完整GeoJSON（Geographic JavaScript Object Notation，地理数据格式）；Point加MultiPoint应有三个点坐标，线条只是复用这些坐标。
- before-map-points与before-map-expanded两张真实原图人工查看：连线三个顶点完整，只有单点A有标记，另两个顶点没有。只读DOM辅助事实同样只有一个marker/单点A；模型自述三个点并非通过证据。普通和展开同现，数据正确但可见多点缺失。
- 直接触发为canonical MultiPoint；唯一renderMarkers明确跳过所有非Point，fill/line图层仅绘制线面。递归visitPositions却把MultiPoint计入bounds，造成视口包含位置但标记未创建。旧Point路径及地图worker/attribution/绘制归属修复均未补齐这项几何适配，不能靠改作者MultiPoint为多个Point或新增后台数据改写根治。
- 横向审查覆盖唯一schema、Provider工具投影/提示、InteractiveArtifactPart分派、共享renderer/普通展开、六种几何、主题重新创建markers、ResizeObserver、销毁、原GeoJSON导出。所有Work/Task/Mission等产物入口均共享此显示路径；源数据/持久格式/导出不受损。没有API/schema/配置/数据迁移变化；没有执行调度、队列、恢复或终态故障，旧23文件/2287行及样本Git/SQLite保护通过。
- 同一真实中文页面的canvas名称Map、Zoom in/out与Toggle attribution仍为英文；现无locale选项，未命名marker的Map point和未命名线的Series亦硬编码。已检索当前MapLibre6.4.1源码：公开MapOptions.locale用于初始化，当前无公开动态locale setter，控制标题只在onAdd创建；禁止触碰私有_locale、重建地图或复制一套导航行为。底图地名/品牌/真实第三方attribution保持来源文字，不改写事实。
- 数据修复：提取唯一artifactMapPoints纯数据投影，按原要素顺序将Point及MultiPoint各坐标投影为Marker位置并保留原要素引用，其他几何仍由现线面图层负责。只取经纬度供现Marker.setLngLat，原2至4维坐标完整保留在源数据和导出；不把折线顶点当点，不去重或重排，不改现featureLabel规则。删除旧Point-only路径，主题更新/清理共享同一Marker实例集合。新增聚焦正向strict输出测试验证混合几何产生完整三点、来源属性和坐标维度投影，不新增UI测试。
- 语言修复：一个当前t驱动的locale表接入MapOptions.locale；局部语言effect仅通过公开getCanvas/getContainer返回的元素更新现控件title/aria-label和marker名称，不接管点击/事件/原生禁用状态，不重建map或改变视口。点名、未命名系列及数字接入中英语言面，作者名称保持原文；数据主题仍走唯一observeAppliedTheme。MapLibre原生导航/键盘/署名保留。
- 风险和验收：新bundle新服务重开同一真实产物，人工复核三个位置各有标记、连线与marker对齐；真实缩放/平移/展开关闭，切英语深色后保留视口/三点并更新控件名称，返回中文；实际下载和复制GeoJSON保持原三项/981字节。当前不扩展为地图交互详情、几何schema规则、性能/大量标记、世界环绕或底图更换；这些没有原生覆盖时如实注明。

## 首候选复核与本地化修订

- run89加载59.70秒构建/原79965退出0、renderer public surface通过、typecheck25419退出0及2语言3356键检查。纯地图数据测试1项/2个正向断言通过；实际canonical parser/生产导出与原生基线981字节完整一致，三个原要素投影为三个点位置。
- candidate-map-points原图已人工查看：三个蓝色marker分别位于原连接线三个顶点，多点缺项已复现后修正。但实际AX名称为“地图：{title}”，不能算最终本地化通过。根因为本人新文案使用单花括号，现fillTemplate明确只插值双花括号；同批未命名系列index文案亦受影响。i18n检查只证明两语言键匹配，不能替代真实名称检查。
- 修订限中英两处canvas/series文案为仓库现双括号插值合同，不改公共i18n解析器、t调用或原数据；重新构建、新run90复核真实地图名称和双语控件。保留候选原图/实际AX片段，不冒称最终通过；原23文件/2287行保全通过，run89自有页面已关闭，服务按排空正常退出收据核对。

## 最终原生验收、证据边界与交付

- 最终53.17秒构建/原97385已join退出0、renderer public surface通过；两语言3356键检查通过。数据实现与25419类型通过/1项2断言正向测试一致，最后仅文案插值修订；没有新增或运行UI自动化，也没有把静态检查当作视觉通过。
- run90同一真实产物的9张accepted原图逐张人工查看：普通三点、原生放大、真实拖动后标记/线条同移、展开三点、英语深色/深色展开、原生来源说明和回中文均可见。缩放首帧图是动画中的真实帧，后续pan/expanded图证明稳定缩放结果。原生英语Zoom out也执行，返回中文/跟随系统后视口未回初始取景，三点/线条仍对应；初始及返回的canvas实际名称均含原标题，英语名称Map:加原中文标题，控件中英随语言更新。第三方地名和署名按原配置保留来源文字，未改底图为暗色服务。
- 原生菜单基线、最终浅色/深色三个下载各981字节；普通复制、展开复制和实际Ctrl+V粘贴到自有空草稿的三份内容亦各981字节，六份均与当前生产导出逐字节一致。独立JSON解析逐值核对原三要素/坐标/属性；canonical parser与唯一实际点投影核对三个位置。粘贴只作验收，随后清空自有草稿，没有发送附加任务或写项目文件。
- 复制差异如实保留：首次展开AX点击观察到Copied，但读回/实际粘贴仍为838字节原任务文本；普通视图再点得981字节GeoJSON。检查ArtifactActions→copyText→browser transport，唯一实现直接await navigator.clipboard.writeText后反馈，没有展开分支。随后用真实“复制消息”建立838字节可辨基线，展开后从当前截图坐标点击复制图标，得到981字节GeoJSON，再关闭并Ctrl+V实际粘贴同样981字节。该最终真实路径通过，初次操作差异的具体原因仍未知，不能据此臆造产品根因或修改共享剪贴板；初次失败不计通过，记录有界反馈并保留原件于私有scratch。
- 12张原图（2基线/1候选/9最终）均人工查看；实际AX名称和DOM标记事实只作截图/交互的辅助。MapLibre只有Point/MultiPoint新投影和现Marker生命周期；现六种几何的线面路径源码审计保持，原生本批只覆盖Point/MultiPoint/LineString，未声称polygon/多线、多重世界、空几何、2万要素性能、未命名标签、其他五主题或屏幕阅读器语音通过。
- run88–90总9次精确gpt-6.1-sol请求全部HTTP200/streaming/reader settled/EOF，含真实发布任务及各服务预检/记忆；原54367/12168/6572分别明确join退出0。run88正常排空约76秒，有持续流式活动，非任务终态异常；run89/90排空即时完成。配对凭据/目录副本实际退役，自有074/080/084页面关闭，原23文件/2287旧行/样本Git/SQLite最终保护通过；没有调度/恢复/终态异常、委托或发布。
- [证据目录](../../artifacts/2026-11-27-map-point-geometry/README.md)归档实际源输入/API/原图/原下载与有界事实。交付范围为唯一地图点投影、现原生MapLibre语言呈现、正向数据测试、中英键、当前架构及本批记录/证据/三索引单链接。上游普通合并、范围提交、正常push与实际远端核验以本批Git及私有delivery receipt为准，不提前宣称完成。
