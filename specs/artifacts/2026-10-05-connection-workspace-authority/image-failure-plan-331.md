# 331 图片解码失败可见性

## Recall

用户要求持续自主改善 UI/UX（User Interface/User Experience，界面与体验）、功能和缺陷，并最新要求单 agent 工作。root 独立调查、实现、浏览器操作和复核，不委派开发或产品子 agent。330 已修复图片 Source 打开后只显示不可编辑占位，PNG 正常预览、缩放、窄侧栏、文本404恢复第24行与焦点均真实验证；提交 `4aae5a3a71cf51a0b0b4a35a94d384f357450e69` 与远端一致、工作区干净、330 全部自有资源收敛。损坏图片是明确未验收边界，本轮补查。

已读 ImagePreview 完整缩略图/全屏/测量/复制/资源加载路径，image-preview service 所有者，FilePart、Composer、BrowserPreview、FileEditor 调用点，当前架构07-panel及旧 API（Application Programming Interface，应用程序接口）authority决策。全仓检索 ImagePreview/PreviewableImage/imageAttributes/onError：当前 imageAttributes 调用方只提供元数据，没有自定义加载处理。检索到 image-preview-authority.test 是纯 service 状态契约，本轮不作为视觉测试运行或修改；未发现当前目标的组件/DOM（Document Object Model，文档对象模型）自动测试。

## 改动前分析

PreviewableImage 只有 img，不接收原生 error；ImagePreviewHost 同样只有 onLoad，HTTP资源失败文案却使用“Copy failed”键。measureLoadedImage 用 naturalWidth || width，布局宽度可能把失败图误当就绪；打开后的 complete 检查也可能测量损坏图。直接触发候选是后端成功返回字节但浏览器解码失败；缺少真实失败画面前不能宣称已复现。

已查权威资料：[HTMLImageElement.complete](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete) 说明损坏图也可能 complete=true；[HTMLImageElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement) 描述加载/渲染失败的 error 事件及 intrinsic（固有）尺寸。现有“HTTP读取成功”和“浏览器图片成功”是不同事实。旧330只把原FileContent接入共享预览，并未处理共享预览自身的失败状态。

影响面为共享缩略图的文件来源、附件、Composer、浏览器证据，以及统一全屏宿主的Markdown/截图入口。候选仅在各自已有图片DOM拥有者记录当前src解码失败，源变化清理；使用真实error/load/固有尺寸，保留真实资源错误，不添网络请求、重试循环、路径匹配补丁、备用图片、缓存或新预览器。失败时提供中英文说明、保持关闭和真实来源入口，缩放/平移仅针对已成功解码图片。复制不能继续把失败图称为加载中。作用是呈现，不改文件读取、工具输出、Provider或调度。若出现共享调度/恢复异常必须横向审计，不能凭页面标签判断。

## 真实验收与收敛

fresh NativeService `/ui`18302，沿用launch-305原生监督，出生起600000ms固定上限及真实活动监督、累计12次模型请求。已授权OpenAI与完整models成对复制，分别预检usable/projected/实际gpt-6.1-sol流式，再通过普通Work/Chat只读本轮PNG并短述，不派发成员。PNG为仓库原资产字节副本；模型先读正常文件得到真实Source并结束。随后只把本轮自己PNG原件移到同Run quarantine保管，原路径放入明确不是PNG的普通文本，以触发真实文件读取成功/浏览器解码失败；不向模型发送损坏图片，不注入界面或消息。

root保存并人工查看原缩略图、全屏、失败交互后补完整根因准入。修改唯一共享组件、必要局部样式/中英文；类型和构建后只刷新自有页面，服务与预算不重置。再次点击同真实Source、查看失败说明/全屏关闭；恢复原字节，在同一文件面板 Reload 后查看正常图片和全屏缩放。当前源变化必须能恢复，不保留旧失败。检查实际所有者、请求和文件保管，UI只做人工交互与截图，禁止UI自动化、DOM断言、快照、像素比较和browser fixture。

所有原执行句柄实际结束，Native/Host/output/request/18302/复制凭据模型配对分别清理，关闭自己的页面并恢复测试原件。记录已覆盖与未覆盖入口；同步架构、根/月/目录索引和docs:check。范围提交、fresh fetch/merge、待推送集合检查与正常push后继续goal，不能把本轮局部场景宣布为全产品完成。

## 真实复现与修改准入

真实read正常PNG后完成，root仅保管自己原PNG并替换为普通文本。点击既有Source时缩略图只剩破图符号和文件名，全屏也是破图却提供100%及缩放。原生实际complete=true、naturalWidth/Height=0，而布局尺寸131×20，印证measureLoadedImage用布局尺寸可把失败图当就绪。真实Copy image随后提示“clipboard blocked”，无法从此提示区分图片已解码失败与剪贴板原因。截图01/02/03与只读原生状态保留。

据此准入共享组件：缩略图按自身当前src的真实error/load提供紧凑说明；全屏根据原生固有尺寸和error判定可用性，保留真实资源错误详情，显示通用失败说明；失败图不提供无意义缩放/平移，Copy先报告image unavailable，再走既有clipboard判断。使用现有Feedback和主题，保留下载原字节与关闭，不添自动重试。源更换必须清理原失败并在恢复正常PNG后重测。

## 结果与 Recall 更新

共享组件/现有样式/中英文三组提示已落地。类型8062与构建48261实际0，main-Dj0Uk9_u.js；真实原失败输入下缩略图、全屏、复制提示及尺寸菜单已亲见，英文/中文都复核。原22168字节PNG移回后，原面板Reload恢复图片、再次全屏100→125%。11张截图逐张人工查看，页面语言恢复English/System。完整[证据与未验范围](image-failure-331/README.md)。

纯目录结构检查2语言2127键通过，不是UI/源码文案测试。实际后端5次Sol流式EOF、原Source、无效响应与原输入恢复通过。自己109页关闭，原65956 actual exit0，Native75928/Host73172/18302/output/request及配对复制凭据模型完整收敛，未重置10分钟边界。架构已更新；文档检查、范围提交和正常push后继续goal。本轮不证明所有图片消费者/格式/网络错误/竞争切换均完成。
