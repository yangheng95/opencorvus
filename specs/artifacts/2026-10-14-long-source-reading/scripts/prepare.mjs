import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('.tmp-product-iteration')
const scratch=path.join(root,'long-source-reading-406')
const topics=[
 '显示真实执行状态','让来源标题可辨认','保留完整导航目标','显示网页所属站点','区分同名本地文件','给出准确文件行号',
 '复制原始资源位置','让多条来源便于展开','保留来源摘录原文','区分引用与新增资料','保持正文阅读位置','保护用户展开状态',
 '支持键盘焦点','展示明确的点击反馈','清楚报告读取错误','让重试作用于原对象','使用当前界面语言','保留作者原始内容',
 '呈现可靠的空状态','区分等待与持续工作','显示工具真实身份','保留真实操作顺序','维持侧栏排版密度','避免文字和动作遮挡',
 '允许查看完整长标题','支持长摘录内部滚动','完成后仍能查看来源','重开后恢复阅读上下文','保持窄栏信息层级','让滚动控制可发现',
 '在更新时保留已读正文','正确区分初次渲染','独立表达不同会话状态','保持复制与打开目标一致','把问题与证据一起记录','明确标出未验证的范围',
]
const body=topics.map((topic,i)=>[
 `## R${String(i+1).padStart(2,'0')} ${topic}`,
 `要求：在产品交互中${topic}，让读者能够理解当前事实并选择下一步操作。`,
 `观察：以实际页面、输入和操作结果核对该条要求，记录发生变化的具体对象与时刻。`,
 `复核：结合原始记录再次检查，确认界面表达和真实数据一致；证据不足时保留未完成结论。`,
].join('\n')).join('\n')+'\n'
fs.writeFileSync(path.join(scratch,'reading-input.md'),body,{flag:'wx'})
const prompt='请独立完成一次逐条阅读，不委派其他agent、不写文件、不使用脚本批量读取。README.md恰好包含R01到R36共36条资料，每条4行。请从第一条开始：用read读取offset=1、limit=4，读完后在普通可见回复中用“R01”开头输出60—100字中文解释；然后再读offset=5、limit=4并输出R02。以同样方式逐条推进到R36（offset=141、limit=4）。每次只读取一条，先输出这一条解释再继续下一条，不把多个读取并行或合并成一次，也不要先读完整文件。所有解释保留工具返回的真实来源。完成36条后用一句话收尾。'
fs.writeFileSync(path.join(scratch,'prompt.txt'),prompt+'\n',{flag:'wx'})
const old='live-sol-source-reading-405',next='live-sol-long-source-reading-406'
for(const suffix of ['.ts','-launch.ps1','-shutdown.ps1']){
 let s=fs.readFileSync(path.join(root,old+suffix),'utf8').replaceAll(old,next).replaceAll('source-reading-405-bundle','long-source-reading-406-bundle')
 if(suffix==='.ts'){
  const literal='"# Isolated formal Task resource qualification\\n"'
  if(!s.includes(literal))throw Error('Original input initialization missing')
  s=s.replace(literal,'await fs.readFile(path.resolve(import.meta.dir, "long-source-reading-406/reading-input.md"), "utf8")')
 }
 fs.writeFileSync(path.join(root,next+suffix),s,{flag:'wx'})
}
fs.writeFileSync(path.join(scratch,'builtin.json'),JSON.stringify({kind:'builtin',id:'base',namespace:'builtin'})+'\n',{flag:'wx'})
const bundle='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-bundle/bin'
fs.mkdirSync(bundle,{recursive:true})
fs.copyFileSync(path.join(root,'sse-compression-305/bun140/bun-windows-x64/bun.exe'),path.join(bundle,'bun.exe'),fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({sections:topics.length,lines:body.trimEnd().split('\n').length,bundle,phase:'prepared without credential copy or service launch'}))
