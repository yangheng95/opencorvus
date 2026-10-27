# 作品返回导航调查证据

对应[调查、实施与实际验收记录](../../records/2026-10/2026-10-27-artifact-return-navigation.md)。675基线复现失位；676/677未达标，678修正诊断工具，679日志定位过早结清；680普通构建实际验证最终修复。

- [基线几何、真实接口与正常关闭回执](baseline-evidence.json)
- [01 原内容可见，标题在上方](01-json-visible-before-fullscreen-en.jpg)
- [02 原作品标题与内容可见](02-json-header-before-fullscreen-en.jpg)
- [03 同一JSON原生全屏](03-json-fullscreen-en.jpg)
- [04 直接关闭后的原阅读位置变化](04-json-return-after-close-en.jpg)
- [05 全屏内搜索再关闭，产物离开当前视口](05-json-after-search-close-en.jpg)
- [676中间结果和几何](intermediate-676-evidence.json)：查询返回改善，重复操作仍偏移，未判成功。
- [06 中间方案打开前](06-json-before-fixed-close-en.jpg)、[07 中间方案直接关闭](07-json-direct-close-restored-en.jpg)、[08 中间方案全屏查询](08-json-search-fullscreen-en.jpg)、[09 中间方案查询后关闭](09-json-search-close-restored-en.jpg)、[10 中间方案重复前](10-json-before-repeat-en.jpg)、[11 中间方案重复后仍有偏移](11-json-repeat-restored-en.jpg)。文件名中的restored不是最终验收结论。
- [677未达标几何](intermediate-677-evidence.json)、[12 进入前](12-final-json-before-open-en.jpg)、[13 退出仍偏移](13-final-json-direct-close-en.jpg)。该候选不是最终交付。
- [678诊断工具结果](intermediate-678-evidence.json)、[14 诊断前](14-diagnostic-before-en.jpg)、[15 诊断后](15-diagnostic-return-en.jpg)：对象日志仅给Object标签，已修正输出，不据此判根因。
- [679序列化真实控制器日志](diagnostic-679-evidence.json)、[16 进入前](16-serialized-diagnostic-before-en.jpg)、[17 退出后](17-serialized-diagnostic-return-en.jpg)：保存1040但在临时末端818就结清，最终可达1538，定位原生视口尚未恢复。

## 最终普通构建680

- [实际几何、公开读取、正常关闭与文件保真证据](final-680-evidence.json)。18组只读观测人工核对，没有UI自动化断言或页面监听注入。
- [18 原生坐标点击前](18-final-before-coordinate-open-en.jpg)、[19 同一作品全屏](19-final-native-fullscreen-en.jpg)、[20 关闭精确回原位](20-final-direct-close-restored-en.jpg)：scrollTop1098.6666、Frame y185.9271保持。
- [21 全屏查询后回原位](21-final-search-close-restored-en.jpg)：同一实例与查询保持；清除查询再次关闭仍回原位。
- [22 内容缩短后停最终末端](22-final-short-content-end-en.jpg)：最终1217.3334；后续真实向上阅读与显式恢复跟随均可用。
- [23 原表格打开前](23-table-before-open-en.jpg)、[24 表格查询返回](24-table-search-return-en.jpg)、[25 键盘重复返回](25-table-repeat-return-en.jpg)：重复前后top298/y244.4271保持。
- [26 简体中文表格查询返回](26-table-return-zh.jpg)：原字段/字符串false保真，产品控件、日期、行计数中文，读位保持。
- [27 原JSON链接实际打开文件工作区](27-json-file-workbench-zh.jpg)：只读查看原内容，没有保存。
- [28 背景成员读位](28-agent-background-before-zh.jpg)、[29 主作品全屏后成员读位恢复](29-agent-background-return-zh.jpg)：成员top206、following=false保持；全屏中其实际值被临时压至0。

29张原图均实际查看，03/08/19为2560×1440，其余1280×720，未裁剪、编辑或作像素断言。675—680各自正常关闭，原执行/宿主/启动器0、公共关闭200、物理/输出/请求结清；680余量876842ms，源92表24614行与888项关键事实、七份原项目文件保持。均未复制认证，0新模型请求，累计315。模型暂不可用提示是自有只读环境明确无认证的结果。MCP内部新全屏、Side Chat内部作品、Escape原生退出、原生媒体及跨屏窗口变化未获本轮实页覆盖；本轮文件链接为普通模式打开。
