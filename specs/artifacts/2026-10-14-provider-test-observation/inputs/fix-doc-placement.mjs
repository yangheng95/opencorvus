import fs from 'node:fs'
const provider='specs/current/architecture/06-provider.md'
let text=fs.readFileSync(provider,'utf8').replaceAll('\r\n','\n')
text=text.replace('### Provider 声明与可运行模型\n\n### Provider 连接测试回执','### Provider 连接测试回执')
text=text.replace('`config.provider[id].models` 是可选配置覆盖','### Provider 声明与可运行模型\n\n`config.provider[id].models` 是可选配置覆盖')
fs.writeFileSync(provider,text)
const panel='specs/current/architecture/07-panel.md'
text=fs.readFileSync(panel,'utf8').replaceAll('\r\n','\n')
text=text.replace('Provider authoring uses one pure endpoint-edit validator for localized field\n\nProvider connection Test','Provider connection Test')
text=text.replace('feedback, save/discovery actions and the canonical form writer. New or explicit','Provider authoring uses one pure endpoint-edit validator for localized field\nfeedback, save/discovery actions and the canonical form writer. New or explicit')
fs.writeFileSync(panel,text)
const record='specs/records/2026-10/2026-10-14-provider-test-observation.md'
text=fs.readFileSync(record,'utf8').replace('仅两个既有一层子agent并行只读审计，禁止再次委托。','用户已要求停止全部子agent；后续由Root独立完成调查、实现和验收，禁止继续委托。')
text += '\n最终输出合同实施后，SDK26062完成37adcb实际exit0；Root服务329a0a exit0（64项177断言），Node最终build71852完成4067a9 exit0。部分流测试首轮3930完成d26526 exit1（18 pass/2 fail）：期望误把SDK实际已归一化的明确message当对象字符串，真实接收值为Owned stream refusal，错误前output确实OK。核对当前SDK7 normalizeStreamProviderError后修正fixture，原checker重跑68912完成f074e0 exit0（20项42断言），不为旧期望改真实实现。Backend类型83966完成a28f8c实际0；Overlay直接Node命令83ebd8前的24f227 exit1为不存在package-local TypeScript路径，按package.json原typecheck重跑20606完成160bf4实际0。formatter工具280c6b exit1为依赖未在根目录链接，复用已安装diff8路径后20539c/481b0a均0，仅应用本任务新增/修改行的格式，原基线格式不变。\n'
fs.writeFileSync(record,text)
const release='CHANGELOG.md'
text=fs.readFileSync(release,'utf8').replaceAll('\r\n','\n')
for(const [anchor,note]of [
 ['#### 修复\n\n','- 服务商连接测试从有效目录选择默认模型，空模型声明继续可测试；零有效模型与配置不可用保持明确原因。结果使用当前语言摘要、实际模型身份和可展开的原始模型回复或完整诊断；保存配置、Key、删除及目录刷新后退休对应旧结果和在途回写。'],
 ['#### Fixed\n\n','- Provider connection tests select the default model from the effective catalog, including inherited models with an empty declaration, and distinguish unavailable configurations from zero models. Results show localized summaries, actual model identity and expandable original model output or complete diagnostics; accepted configuration, key, deletion and catalog changes retire the corresponding observations and late completions.']
]){if(!text.includes(anchor)||text.includes(note))throw Error('Release anchor changed');text=text.replace(anchor,anchor+note+'\n\n')}
fs.writeFileSync(release,text)
