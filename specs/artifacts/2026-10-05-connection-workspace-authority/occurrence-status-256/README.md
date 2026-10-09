# 256 普通会话逐输入状态与来源复核

[实施前Recall与共享调查](../occurrence-status-plan-256.md)。原255两轮结束仍有Running与无输入汇总第三行；本轮从真实生命周期身份修复载入/历史/重连与迟到正文覆盖。

## 当前实现与检查

Session拓扑只提供输入身份/stage；每个真实inputMessageID占一条活动记录。Task已准备输入与持久派发继续拥有原权威。ProtocolStore按每条可见输入读取原生命周期；普通Session历史streaming/retry须有同输入的当前执行拥有者，才能回放运行。hydrate/history/SSE沿同一读取函数，Task重复原事件ID去重。正文/Part只更新内容/导航目标，不改状态；真实输入退休会话占位，慢载入合并也退休该占位。

首次服务器检查13通过/2失败，新增生命周期消费暴露普通事件没有Task kind而hydrate500；诊断原失败保留。projector改从原拓扑/已准备输入读取stage，原服务器检查再执行18通过，新增两输入真实HTTP/历史/SSE正向契约后最终19通过/76断言。Overlay实时数据8通过/10断言，后端/Overlay类型实际0，前端实际build0（56.04秒）与renderer检查通过。数据检查不冒充页面验收，无UI自动化测试。

## 真实桌面页面

Root单独启动真实开发`http://localhost:18192/ui/`，自己的IAB99，当前实际`main-2GYrCS_Q.js`。原生PID75876/birth `win32:639271860886011316`，Host42388/birth `win32:639271860878511724`。完整auth/models副本与目标目录资格检查通过；固定600000毫秒/最多12请求，不延长、不重启。

实际普通Session `ses_-zUSOnmnHzzEEeACTbpE`，Project `prj_hiVxvC6SPAUAJAziRSRV`。同一会话由页面提交三条真实用户输入：`msg_8049f874-78b1-4009-8f9a-9c75097b84d1`、`msg_88ffcf8a-0c37-44bd-b4e9-a6a71e545a1a`、`msg_e813c36c-0f2d-42b9-a38d-688291e9a762`。

- [首轮运行与Sources](live-01/first-running.jpg)：三条真实webfetch来源直接显示W3C/MDN标题和域名，人工查看可读。
- [首轮返回完成页面](live-01/first-return-ready.jpg)与[first-public-view](live-01/first-public-view.json)：自然结束idle，仅一条精确输入；离开/返回仍Not running。first-return图片仅中间加载，不作通过证据。
- [第二轮运行](live-01/second-running.jpg)与[实际公共投影](live-01/second-live-public-view.json)：首轮idle、次轮running；[次轮结束](live-01/second-complete.jpg)自然Not running。
- [第三轮真实运行](live-01/third-running.jpg)与[实际活动栏](live-01/third-running-rail.json)：2026-10-09T23:44:50.071Z前两轮idle/第三轮running，三条输入各绑定自己的目标Message。活动栏原阈值为3，所以增加第三轮验收，没有改阈值或启动Task/新成员。
- [运行中首轮定位](live-01/third-running-first-locate.jpg)打开正确首轮内容；[来源清楚可读](live-01/third-sources-current.jpg)采样时第三轮已自然结束，不能把后者称作仍在运行。其实际状态为三个idle。
- 重载`/ui/`先回首页；手动重新打开原会话。[重开三条记录](live-01/reopened-three-rail.json)在2026-10-09T23:46:38.651Z为三个idle，与[公共事实](live-01/reconnected-public-view.json)一致。[重开Sources](live-01/reopened-sources.jpg)确认标题/域名完整。reload-initial/reconnected-ready是首页阶段，不能宣称自动恢复选中会话或阅读位置。

## 原进程与证据边界

全部11个实际Provider请求均gpt-6.1-sol/streaming:true/200/原reader eof，预算未耗尽；包括原生预检、会话及其真实后台请求，不把请求数量等同用户输入数。自己的页面关闭后由唯一退出路径收敛；原前台命令12385实际join0，原Native terminal0、物理/output/request完成。独立closure实际0，端口18192无监听，精确Native/Host均离开，auth/models副本同时退休。完整脱敏归档保留13935条原生新日志/未知时间0与完整Provider审计，不更改原退出结果。

证据见[live-01](live-01/)、[独立物理收敛](live-01/closure-readback.json)、[原Provider审计](live-01/occurrence-status-256-live-01-final-provider-audit.json)、[原生终态](live-01/occurrence-status-256-live-01-native-host-settled.json)、[原持久内容元数据](live-01/canonical-current-conversations.json)。原500检查与后续最终检查保存在本目录check日志。

## 尚未达成的矩阵

本轮真实三输入普通会话与Sources视觉已复核；长历史分页、Mission、Task重试/恢复/多项目只由相关代码和服务器数据契约覆盖，没有本轮真实Provider/UI资格证据。没有新建成员，未取得新的成员执行验收。物理关闭给最后idle输入附加aborted的跨轮语义仍是单独待调查事项，未改写该真实事件或取消生产者。本轮没有发布版本。
