"""Derive current positive full-state/error contracts from retained original tests."""
from pathlib import Path
from datetime import datetime,timezone
import re,json,difflib
R=Path(__file__).parent;P=R/'consumer';P.mkdir(exist_ok=False)
patch=(R/'original-task/tests/test.patch').read_text(encoding='utf-8')
part=patch.split('@@ -0,0 +1,1016 @@\n',1)[1].split('diff --git a/test.sh',1)[0]
original='\n'.join(line[1:] for line in part.splitlines() if line.startswith('+'))+'\n'
source=original
removed=['coredump_disabled_by_default','coredump_not_generated_for_non_trap_errors','coredump_not_generated_for_host_error','coredump_module_without_memory','coredump_module_without_globals']
for name in removed:
    source,n=re.subn(r'(?ms)^#\[test\]\nfn '+name+r'\(\).*?(?=^#\[test\]|\Z)','',source)
    if n!=1:raise RuntimeError('Original function scope changed: '+name)
source=re.sub(r'\n\s*assert!\(\s*(?:frames\[0\]|frame)\.stack_values\.is_empty\(\),\s*"operand stack should be empty"\s*\);','',source)
source=source.replace('assert!(!coredump.stacks.is_empty());','assert_eq!(coredump.stacks.len(), 1);')
source=source.replace('assert!(\n        !coredump.stacks.is_empty(),\n        "missing \'corestack\' section"\n    );','assert_eq!(coredump.stacks.len(), 1);')
source=source.replace('assert!(\n        !coredump.memory_types.is_empty(),\n        "should have memory type"\n    );','assert_eq!(coredump.memory_types.len(), 1);')
source=source.replace('fn parse_coredump(bytes: &[u8]) -> ParsedCoredump {','''fn parse_coredump(bytes: &[u8]) -> ParsedCoredump {
    // Validate actual standard Wasm structure, then retain the original binary.
    wasmparser::Validator::new().validate_all(bytes).expect("actual coredump must validate as Wasm");
    if let Ok(directory) = std::env::var("WASMI_DUMP_OUTPUT") {
        std::fs::create_dir_all(&directory).unwrap();
        let thread = std::thread::current();
        let name = thread.name().unwrap_or("native-contract");
        std::fs::write(std::path::Path::new(&directory).join(format!("{name}.wasm")), bytes).unwrap();
    }''')
source+='''
// Full explicit Error responses replace three old absence-only assertions.
fn error_response(error: &Error) -> (String, Option<usize>) {
    let kind = match error.kind() {
        wasmi::errors::ErrorKind::TrapCode(code) => format!("wasm_trap:{code:?}"),
        wasmi::errors::ErrorKind::Message(message) => format!("host_message:{message}"),
        wasmi::errors::ErrorKind::Wasm(_) | wasmi::errors::ErrorKind::Wat(_) => "module_decode_error".into(),
        other => format!("other:{other:?}"),
    };
    (kind, error.coredump().map(<[u8]>::len))
}

#[test]
fn complete_error_response_contracts() {
    let engine = Engine::default();
    let module = Module::new(&engine, r#"(module (func (export "trap") unreachable))"#).unwrap();
    let mut store=Store::new(&engine,());
    let instance=Linker::new(&engine).instantiate_and_start(&mut store,&module).unwrap();
    let error=instance.get_typed_func::<(),()>(&store,"trap").unwrap().call(&mut store,()).unwrap_err();
    assert_eq!(error_response(&error),("wasm_trap:UnreachableCodeReached".into(),None));
    let engine=coredump_engine();
    let malformed=Module::new(&engine,b"invalid wasm").unwrap_err();
    assert_eq!(error_response(&malformed),("module_decode_error".into(),None));
    let module=Module::new(&engine,r#"(module (import "env" "host" (func $host)) (func (export "trap") call $host))"#).unwrap();
    let mut store=Store::new(&engine,());let mut linker=Linker::new(&engine);
    linker.func_wrap("env","host",||->Result<(),Error>{Err(Error::new("host error"))}).unwrap();
    let instance=linker.instantiate_and_start(&mut store,&module).unwrap();
    let error=instance.get_typed_func::<(),()>(&store,"trap").unwrap().call(&mut store,()).unwrap_err();
    assert_eq!(error_response(&error),("host_message:host error".into(),None));
}

#[test]
fn complete_zero_resource_module_state() {
    let engine=coredump_engine();
    let (_,dump)=trap_with_coredump(&engine,r#"(module (func (export "trap") unreachable))"#);
    let instances=dump.instances.unwrap();
    let actual=(dump.process_info.unwrap().executable_name,dump.modules.unwrap().len(),instances.len(),instances[0].module_index,instances[0].memory_indices.clone(),instances[0].global_indices.clone(),dump.stacks[0].frames.iter().map(|f|f.func_index).collect::<Vec<_>>(),dump.memory_types.len(),dump.data_segments.len(),dump.globals.len());
    assert_eq!(actual,(String::new(),1,1,0,vec![],vec![],vec![0],0,0,0));
}

#[test]
fn cross_instance_reentry_complete_state() {
    let engine=coredump_engine_with_name("reentry-app");let mut store=Store::new(&engine,());
    let inner=Module::new(&engine,r#"(module (memory (export "memory") 1) (data (i32.const 0) "INN!") (global (export "g") (mut i32) (i32.const 11)) (func (export "trap") unreachable))"#).unwrap();
    let inner_instance=Linker::new(&engine).instantiate_and_start(&mut store,&inner).unwrap();
    let inner_trap=inner_instance.get_typed_func::<(),()>(&store,"trap").unwrap();
    let mut linker=Linker::new(&engine);
    linker.func_wrap("env","callback",move |mut caller:Caller<'_,()>|->Result<(),Error>{inner_trap.call(&mut caller,())}).unwrap();
    let outer=Module::new(&engine,r#"(module (import "env" "callback" (func $callback)) (memory (export "memory") 1) (data (i32.const 0) "OUT!") (global (export "g") (mut i32) (i32.const 22)) (func (export "entry") call $callback))"#).unwrap();
    let instance=linker.instantiate_and_start(&mut store,&outer).unwrap();
    let error=instance.get_typed_func::<(),()>(&store,"entry").unwrap().call(&mut store,()).unwrap_err();
    let dump=parse_coredump(error.coredump().expect("Wasm reentry trap payload"));
    let frames=&dump.stacks[0].frames;
    let instances=dump.instances.as_ref().unwrap();
    assert_eq!(frames.iter().map(|f|f.func_index).collect::<Vec<_>>(),vec![0,1]);
    // Index numbers/order remain opaque: follow each real frame's reference.
    let state=frames.iter().map(|f|{
        let instance=&instances[f.instance_index as usize];
        let memory=reconstruct_memory(&dump.data_segments,instance.memory_indices[0],65536);
        (memory[..4].to_vec(),dump.globals[instance.global_indices[0] as usize].clone())
    }).collect::<Vec<_>>();
    assert_eq!(state,vec![(b"INN!".to_vec(),CoredumpValue::I32(11)),(b"OUT!".to_vec(),CoredumpValue::I32(22))]);
}
'''
(P/'coredump_contract.rs').write_text(source,encoding='utf-8')
(P/'adaptation.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),source.splitlines(True),fromfile='original-private-coredump.rs',tofile='current-positive-coredump-contract.rs')),encoding='utf-8')
(P/'registration.json').write_text(json.dumps(dict(registered_at=datetime.now(timezone.utc).isoformat(),original_test_functions=22,current_functions=re.findall(r'#\[test\]\s*fn (\w+)',source),replaced_original_functions=removed,meaning='Same original API requests/positive WAT outcomes; three absence-only tests replaced by complete actual error response contracts, two resource-absence tests replaced by complete zero-resource-module state. Redundant operand-stack absence assertions removed; parser still consumes every encoded operand. Added prospective actual standard validator/raw-binary retention and cross-instance reentry public contract; reference unchanged.',candidate_started=False,reference_behavior_observed=False),indent=2),encoding='utf-8')
print(json.dumps(dict(functions=len(re.findall(r'#\[test\]',source)),source_bytes=len(source.encode()))))
