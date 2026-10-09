# 250 live-01 实际页面与闭合

独立开发模式 `http://localhost:18185/ui/`，自身 IAB（In-App Browser，应用内浏览器）92，实际 [构建资源](served-assets.json) 为 main-CvIYQtNa.js。完整复制原 153 Run，原 Task tsk_g00VXRkMRi00ID2TqzPU、Project prj_honTzv1SylD1sTwgEqBC、root Session ses_-zUSYFdRdzzk2frR62zX、request 0f315e79-0af3-438e-b26e-d312f2f3e65e 保持原身份。

## 人工视觉复核

- [researcher 顶部](researcher-top.jpg)：真实 WAI（Web Accessibility Initiative，网页无障碍倡议）Introduction/Principles 与 MDN（Mozilla Developer Network，开发者文档）Accessibility 三条来源具有完整标题和域名，header（头部）显示固定 1m1s。
- [tester 顶部](tester-top.jpg)：另一个实际子会话显示固定 1m15s 与原报告。
- [成员切换后返回](researcher-return.jpg)、[列表返回](researcher-list-return.jpg)：仍显示同三条来源和已格式化正文。
- [中段阅读](researcher-middle.jpg)、[整 Dock 重开](researcher-dock-return.jpg)：实际相同段落与 WAI 第二节。即时 PageDown 照片仅代表当时绘制；随后 [滚动稳定观察](researcher-middle-settled-geometry.json) 为 1008，[重开后观察](researcher-dock-return-geometry.json) 仍为 1008，同卡片/会话、24 段、scrollHeight=2948、clientHeight=577、following=false、duration=1m1s。

root 亲自查看以上截图。没有 UI 自动化、渲染断言或截图比较测试。辅助几何读取的 sourceLinks 选择器不对应实际来源元素，数组为空；真实截图和页面快照均显示三条来源，该数组不是缺失来源证据。第一次 AX（Accessibility Tree，无障碍树）显示 checkbox 的 Dock toggle（开关）不能由 DOM（Document Object Model，文档对象模型）checkbox locator（定位器）找到；改用新鲜 AX 的实际控件打开，不把定位器超时归为产品缺陷。公共 AX 文本仅统一换行并去掉行尾空白，原始字节私有保存；第一次 diff --check 的真实行尾空白错误没有当成功。截图及消息事实未修改。

无凭据历史副本没有模型目录，主输入区真实呈现 Model configuration unavailable；当前场景只读历史，保留该提示与日志，不伪称模型授权或 Provider 验收。

## 原结果与完整保管

页面于 2026-10-09T20:26:02.669Z 主动关闭，唯一 shutdown（退出入口）执行成功，原 foreground（前台命令）63704 实际 join（等待完成）exit0。Native（原生进程）75080 / win32:639271737830108724 正常 exit0，Host 为 54144；固定 900000ms 截止从 Host 创建前计算，原窗口内正常闭合，没有延长、重启或替换。

- [原 Host/Native join](child-dock-review-250-live-01-launcher-native-joined.json)、[原生终态](child-dock-review-250-live-01-native-host-settled.json)：实际 physicalCompletion/outputDrainComplete/requestCleanupComplete（物理完成/输出排空/请求清理）为真。
- [sole owner 清理](child-dock-review-250-live-01-physical-terminal-and-pair-cleanup.json)、[独立退役观察](child-dock-review-250-live-01-independent-closure.json)：精确进程已退出，18185 无监听，凭据对不存在。
- [完整复制](child-dock-review-250-live-01-history-copy.json)：90 张表复制时逐行直接相等。[结束保管](final-canonical-custody.json)：13 张核心表再次完整逐行相等，含 17 条 Provider 请求/17 条结果，Task/Session/Project/request 身份保持；本轮没有新模型请求。
- [初次保管失败](custody-initial.log)、[具体目录差异](source-project-property-diff.jsonl)、[复核后实际 exit0](custody-reviewed.log)、[真实检查器](final-custody-checker.ts)：差异只有原主项目 `.git` 目录修改时间，从 1791533753471.563 到 1791577030379.9504；其他目录项/文件属性一致。当前生产 Vcs.status 执行 git status，实际 `/vcs` 于 20:17:10.418Z 返回 200，目录时刻 20:17:10.379Z 与该路径一致。精确限定这一已审查目录属性差异，保存 before/after，不重算期望或改写原失败。原配置与复制配置结束时逐字节相等，不把该观察说成历史启动前字节基线或任意文件内容完整性证明。
- [当前运行日志](child-dock-review-250-live-01-runtime.log)、[HTTP（Hypertext Transfer Protocol，超文本传输协议）请求与时间边界](child-dock-review-250-live-01-http-summary.json)：仅按 canonical 时间纳入新进程窗口；未知时间原行另存，没有把历史日志算入当前结果。
- [精确自身生成文件归档](owned-native-pile-archive.json)：所有页面/原命令/检查器完成后，仅移动本次创建身份所对应五个 .debug.pile 文件，私有保存，不递归删除。

该场景不包含新实时子会话、原 Research Studio Task 或全程闪烁录像；不能从已完成历史照片推出实时全帧通过。本轮没有生产代码修改，持续目标未完成。
