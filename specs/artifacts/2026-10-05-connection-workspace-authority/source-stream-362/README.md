# 362 Sources与持续输出

[Recall与方案](../source-stream-plan-362.md) · [原运行与逐时点事实](checks/runtime-qualification.json)。本批单agent补齐Sources与真实流式更新交叠的观察，未复现新的产品缺陷，未修改生产代码。下一步仍需检查含大量参考历史时的共享reading-anchor可见性候选；本批短Main不能排除它。

## 实际运行

独立NativeService/18360加载当前main-1Vm28pXW.js。配对暂存完整auth/models并分别验证credential usable、catalog projected、实际gpt-6.1-sol streaming后，实际Main与Side先后执行。共有8次HTTP200/streaming请求到Provider source reader EOF，预算12未耗尽。真实search_code查两个目录的同名Markdown并产生16条来源，canonical保留3个Session/9条Message。

长正文msg_g0VXrymGD004FprspYlD创建于20:35:17.565Z、完成于20:37:24.886Z；原Markdown6644字符、4448汉字，DOM显示6422字符。模型未达到所请求的5000–6000汉字，不把此长度条件写成通过。但127321ms实际输出窗口内完成了下列原生操作，两个只读canonical时点分别看到1761/6338字符、completed为空、1个Provider请求pending；不是根据Working文案推断它仍在执行。

## 人工操作与可见结果

| 实际截图 | 时点与证据 |
| --- | --- |
| [01 正文增长](01-side-growing.png) | 628字符，6个块，页面Working，来源初始收起。 |
| [02 输出中展开](02-expanded-while-growing.png) | 968字符，16条来源呈现；following从true变为false，原列表可阅读。 |
| [03 打开中](03-file-open-during-output.png)、[04 第9行](04-file-line-nine-active.png) | 03保留Loading中间帧；04已显示甲目录文件第9行的甲记录08高亮。与此同时canonical确认最终正文还未完成。 |
| [05 返回Side](05-return-during-output.png) | 正文2023字符；返回Source9–16附近，原列表展开且Working可见。 |
| [06 键盘收起](06-collapse-during-output.png)、[07 后续增长](07-current-after-keyboard.png) | Enter收起后焦点回到Show 15 more sources；2488→3022字符、scrollTop562.4保持，已有正文在pending=true样本中仍可见，没有初始Rendering占位。 |
| [08 原生Enter重开](08-reexpand-during-output.png) | 3475字符，16条来源重新展开，scrollTop562.4保持。 |
| [09 关闭状态](09-dock-reopen-during-output.png)、[10 实际重开](10-dock-open-active.png) | 09文件名含reopen但画面仍是关闭态，不算重开成功；10才是实际重新打开，正文4374字符，来源身份/展开状态/scrollTop562.4保留，页面Working。 |
| [11 完成后](11-source-position-later-active.png) | 文件名含active但已晚于canonical终态，composer也恢复输入；最终6422字符、Source首行相对视口偏移约-0.02px保持。不能称为活跃时点。 |
| [12 隐藏期间缩窄后返回](12-return-narrow-completed.png) | 输出完成后在File页把侧栏380→280px，通过More tabs返回Side。scrollTop按布局变为727.2，仍是同一首Source，视口偏移约-0.24px；不是仅凭numeric top相同判恢复。 |

全部12张截图均由root实际查看。初版helper在Tab赋值前捕获了undefined，修正为显式传Tab参数后重新采样；没有把该工具错误当作产品bug。原生details摘要在AX（Accessibility，无障碍）树有button身份，但当前Playwright role locator没有命中；按实际AX焦点用原生Enter完成，未加产品绕行。关闭后曾误用旧AX序号，原09关闭画面保留；重新使用当前Side chat按钮后10才验明成功。缩窄后Side标签进入实际More tabs菜单，按可见菜单返回，未使用隐藏标签执行。

## 边界与交付

观察helper显式标注closed Reference history，不把其非零缓存geometry当成绘制内容。当前实例Main只有两条短消息；它不能排除大量折叠历史导致reading-anchor误选的候选，也不能证明所有帧无闪烁或原Research Studio成员侧栏全部正常。359跨网站首次复制异常仍未知。没有新增或运行UI自动化测试，没有接口/调度/消息/Source数据改动，也没有为得到通过而缩短原请求或修改真实输出。

原build62001实际exit0，50.30s，renderer公共表面检查通过。docs:check和architecture-index由当前package脚本执行；它们不作视觉证据。原服务在固定600000ms的271072ms内关闭，原exec30151实际exit0，Host/Native、output/request/端口及auth/models配对清除均有独立回执；原scope没有重启或延时。全部Provider、canonical、HTTP、closure及helper原文脱敏归档；归档压缩只验证原字节完整性，不替代功能验收。
