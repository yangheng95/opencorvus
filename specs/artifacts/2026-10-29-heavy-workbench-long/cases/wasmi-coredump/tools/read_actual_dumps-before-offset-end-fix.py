"""Independent stdlib decoding of retained actual coredump objects, no generator code."""
from pathlib import Path
import json,struct
R=Path(__file__).parent
class Reader:
    def __init__(self,data):self.data=data;self.pos=0
    def read(self,n):
        if self.pos+n>len(self.data):raise ValueError('Binary field outside retained object')
        out=self.data[self.pos:self.pos+n];self.pos+=n;return out
    def byte(self):return self.read(1)[0]
    def leb(self,signed=False):
        value=0;shift=0
        while True:
            b=self.byte();value|=(b&127)<<shift;shift+=7
            if shift>70:raise ValueError('Integer outside declared LEB domain')
            if b<128:break
        return value-(1<<shift) if signed and b&64 else value
    def name(self):return self.read(self.leb()).decode('utf-8')
    def vector(self,fn):return [fn() for _ in range(self.leb())]
    def value(self):
        tag=self.byte()
        if tag in (0x7f,0x7e):return dict(type='i32' if tag==0x7f else 'i64',value=self.leb(True))
        if tag in (0x7d,0x7c):return dict(type='f32' if tag==0x7d else 'f64',bits=int.from_bytes(self.read(4 if tag==0x7d else 8),'little'))
        if tag==1:return dict(type='unrecoverable')
        raise ValueError('Unknown public value tag '+str(tag))
    def expect(self,n):
        actual=self.byte()
        if actual!=n:raise ValueError(f'Expected public prefix {n}, got {actual}')
def decode(data):
    outer=Reader(data)
    if outer.read(8)!=b'\0asm\x01\0\0\0':raise ValueError('Invalid Wasm header')
    result=dict(modules=[],instances=[],stacks=[],memory_types=[],globals=[],data=[])
    while outer.pos<len(data):
        section=outer.byte();r=Reader(outer.read(outer.leb()))
        if section==0:
            name=r.name()
            if name=='core':r.expect(0);result['executable_name']=r.name()
            elif name=='coremodules':
                def module():r.expect(0);return r.name()
                result['modules']=r.vector(module)
            elif name=='coreinstances':
                def instance():
                    r.expect(0);return dict(module=r.leb(),memories=r.vector(r.leb),globals=r.vector(r.leb))
                result['instances']=r.vector(instance)
            elif name=='corestack':
                r.expect(0);thread=r.name()
                def frame():
                    r.expect(0);return dict(instance=r.leb(),function=r.leb(),code_offset=r.leb(),locals=r.vector(r.value),operands=r.vector(r.value))
                result['stacks'].append(dict(thread=thread,frames=r.vector(frame)))
        elif section==5:
            def memory():
                flags=r.byte();initial=r.leb();maximum=r.leb() if flags&1 else None
                return dict(flags=flags,initial=initial,maximum=maximum)
            result['memory_types']=r.vector(memory)
        elif section==6:
            def glob():
                typ=r.byte();mut=r.byte();opcode=r.byte()
                if opcode not in (0x41,0x42,0x43,0x44):raise ValueError('Global initializer is not declared numeric opcode')
                if opcode in (0x41,0x42):v=dict(type='i32' if typ==0x7f else 'i64',value=r.leb(True))
                else:v=dict(type='f32' if typ==0x7d else 'f64',bits=int.from_bytes(r.read(4 if typ==0x7d else 8),'little'))
                r.expect(11);return dict(v,mutable=mut)
            result['globals']=r.vector(glob)
        elif section==11:
            def segment():
                flags=r.leb()
                if flags not in (0,2):raise ValueError('Data segment outside active public contract')
                memory=r.leb() if flags==2 else 0;r.expect(0x41);offset=r.leb(True);raw=r.read(r.leb())
                return dict(memory=memory,offset=offset,raw=raw)
            result['data']=r.vector(segment)
    memories=[bytearray(x['initial']*65536) for x in result['memory_types']]
    for seg in result['data']:
        memory=memories[seg['memory']];start=seg['offset'];end=start+len(seg['raw'])
        if start<0 or end>len(memory):raise ValueError('Active data outside declared memory')
        memory[start:end]=seg['raw']
    result['memory_prefixes']=[list(x[:4]) for x in memories]
    result['data']=[dict(memory=x['memory'],offset=x['offset'],length=len(x['raw'])) for x in result['data']]
    return result
all_results=[]
for p in sorted((R/'reference-consumption-corrected/actual-dumps').glob('*.wasm')):
    d=decode(p.read_bytes());all_results.append(dict(name=p.name,bytes=p.stat().st_size,decoded=d))
target=R/'reference-consumption-corrected/independent-decoded.json'
target.write_text(json.dumps(all_results,indent=2),encoding='utf-8')
cross=next(x for x in all_results if x['name']=='cross_instance_reentry_complete_state.wasm')
d=cross['decoded'];actual=[]
for f in d['stacks'][0]['frames']:
    instance=d['instances'][f['instance']]
    actual.append(dict(function=f['function'],prefix=d['memory_prefixes'][instance['memories'][0]],global_value=d['globals'][instance['globals'][0]]['value']))
expected=[dict(function=0,prefix=list(b'INN!'),global_value=11),dict(function=1,prefix=list(b'OUT!'),global_value=22)]
verdict=dict(scope='Independent stdlib read of the original actual binary; no new VM execution or source patch',decoded_objects=len(all_results),cross_instance_actual=actual,cross_instance_expected=expected,cross_instance_matches=actual==expected)
(R/'reference-consumption-corrected/independent-verdict.json').write_text(json.dumps(verdict,indent=2),encoding='utf-8');print(json.dumps(verdict,indent=2))
