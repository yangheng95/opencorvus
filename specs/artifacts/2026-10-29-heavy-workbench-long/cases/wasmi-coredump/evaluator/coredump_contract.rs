use wasmi::{Caller, Config, Engine, Error, Extern, Linker, Module, Store};

struct WasmReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> WasmReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len() - self.pos
    }

    fn read_u8(&mut self) -> u8 {
        assert!(
            self.pos < self.data.len(),
            "unexpected end of data at offset {}",
            self.pos
        );
        let b = self.data[self.pos];
        self.pos += 1;
        b
    }

    fn read_bytes(&mut self, n: usize) -> &'a [u8] {
        assert!(
            self.pos + n <= self.data.len(),
            "unexpected end of data: need {} bytes at offset {}",
            n,
            self.pos
        );
        let s = &self.data[self.pos..self.pos + n];
        self.pos += n;
        s
    }

    fn read_u32_leb128(&mut self) -> u32 {
        let mut result: u32 = 0;
        let mut shift = 0;
        loop {
            let byte = self.read_u8();
            result |= ((byte & 0x7F) as u32) << shift;
            if byte & 0x80 == 0 {
                break;
            }
            shift += 7;
        }
        result
    }

    fn read_i32_leb128(&mut self) -> i32 {
        let mut result: i32 = 0;
        let mut shift = 0;
        let mut byte;
        loop {
            byte = self.read_u8();
            result |= ((byte & 0x7F) as i32) << shift;
            shift += 7;
            if byte & 0x80 == 0 {
                break;
            }
        }
        if shift < 32 && (byte & 0x40) != 0 {
            result |= !0i32 << shift;
        }
        result
    }

    fn read_i64_leb128(&mut self) -> i64 {
        let mut result: i64 = 0;
        let mut shift = 0;
        let mut byte;
        loop {
            byte = self.read_u8();
            result |= ((byte & 0x7F) as i64) << shift;
            shift += 7;
            if byte & 0x80 == 0 {
                break;
            }
        }
        if shift < 64 && (byte & 0x40) != 0 {
            result |= !0i64 << shift;
        }
        result
    }

    fn read_f32_bytes(&mut self) -> u32 {
        let bytes = self.read_bytes(4);
        u32::from_le_bytes(bytes.try_into().unwrap())
    }

    fn read_f64_bytes(&mut self) -> u64 {
        let bytes = self.read_bytes(8);
        u64::from_le_bytes(bytes.try_into().unwrap())
    }

    fn read_name(&mut self) -> String {
        let len = self.read_u32_leb128() as usize;
        let bytes = self.read_bytes(len);
        String::from_utf8(bytes.to_vec()).unwrap()
    }
}

#[derive(Debug, Clone, PartialEq)]
enum CoredumpValue {
    I32(i32),
    I64(i64),
    F32(u32),
    F64(u64),
    Missing,
}

fn read_coredump_value(r: &mut WasmReader) -> CoredumpValue {
    match r.read_u8() {
        0x01 => CoredumpValue::Missing,
        0x7F => CoredumpValue::I32(r.read_i32_leb128()),
        0x7E => CoredumpValue::I64(r.read_i64_leb128()),
        0x7D => CoredumpValue::F32(r.read_f32_bytes()),
        0x7C => CoredumpValue::F64(r.read_f64_bytes()),
        tag => panic!("unknown coredump value tag: 0x{tag:02x}"),
    }
}

fn read_coredump_values(r: &mut WasmReader) -> Vec<CoredumpValue> {
    let count = r.read_u32_leb128();
    (0..count).map(|_| read_coredump_value(r)).collect()
}

#[derive(Debug)]
struct RawSection {
    id: u8,
    data: Vec<u8>,
}

fn parse_wasm_sections(bytes: &[u8]) -> Vec<RawSection> {
    let mut r = WasmReader::new(bytes);
    assert_eq!(r.read_bytes(4), b"\0asm", "not a valid Wasm binary");
    let version = u32::from_le_bytes(r.read_bytes(4).try_into().unwrap());
    assert_eq!(version, 1, "unsupported Wasm version");
    let mut sections = Vec::new();
    while r.remaining() > 0 {
        let id = r.read_u8();
        let size = r.read_u32_leb128() as usize;
        let data = r.read_bytes(size).to_vec();
        sections.push(RawSection { id, data });
    }
    sections
}

fn get_custom_section_data<'a>(section: &'a RawSection) -> (String, &'a [u8]) {
    assert_eq!(section.id, 0);
    let mut r = WasmReader::new(&section.data);
    let name = r.read_name();
    let data_start = r.pos;
    (name, &section.data[data_start..])
}

#[derive(Debug)]
struct ProcessInfo {
    executable_name: String,
}

fn parse_core_section(data: &[u8]) -> ProcessInfo {
    let mut r = WasmReader::new(data);
    assert_eq!(r.read_u8(), 0x00, "expected process-info prefix byte");
    ProcessInfo {
        executable_name: r.read_name(),
    }
}

#[derive(Debug)]
struct ModuleEntry {
    #[allow(dead_code)]
    name: String,
}

fn parse_coremodules_section(data: &[u8]) -> Vec<ModuleEntry> {
    let mut r = WasmReader::new(data);
    let count = r.read_u32_leb128();
    (0..count)
        .map(|_| {
            assert_eq!(r.read_u8(), 0x00, "expected module prefix byte");
            ModuleEntry {
                name: r.read_name(),
            }
        })
        .collect()
}

#[derive(Debug)]
struct InstanceEntry {
    module_index: u32,
    memory_indices: Vec<u32>,
    global_indices: Vec<u32>,
}

fn parse_coreinstances_section(data: &[u8]) -> Vec<InstanceEntry> {
    let mut r = WasmReader::new(data);
    let count = r.read_u32_leb128();
    (0..count)
        .map(|_| {
            assert_eq!(r.read_u8(), 0x00, "expected instance prefix byte");
            let module_index = r.read_u32_leb128();
            let mem_count = r.read_u32_leb128();
            let memory_indices = (0..mem_count).map(|_| r.read_u32_leb128()).collect();
            let glob_count = r.read_u32_leb128();
            let global_indices = (0..glob_count).map(|_| r.read_u32_leb128()).collect();
            InstanceEntry {
                module_index,
                memory_indices,
                global_indices,
            }
        })
        .collect()
}

#[derive(Debug)]
struct FrameEntry {
    instance_index: u32,
    func_index: u32,
    code_offset: u32,
    locals: Vec<CoredumpValue>,
    stack_values: Vec<CoredumpValue>,
}

#[derive(Debug)]
struct StackEntry {
    thread_name: String,
    frames: Vec<FrameEntry>,
}

fn parse_corestack_section(data: &[u8]) -> StackEntry {
    let mut r = WasmReader::new(data);
    assert_eq!(r.read_u8(), 0x00, "expected thread-info prefix byte");
    let thread_name = r.read_name();
    let frame_count = r.read_u32_leb128();
    let frames = (0..frame_count)
        .map(|_| {
            assert_eq!(r.read_u8(), 0x00, "expected frame prefix byte");
            let instance_index = r.read_u32_leb128();
            let func_index = r.read_u32_leb128();
            let code_offset = r.read_u32_leb128();
            let locals = read_coredump_values(&mut r);
            let stack_values = read_coredump_values(&mut r);
            FrameEntry {
                instance_index,
                func_index,
                code_offset,
                locals,
                stack_values,
            }
        })
        .collect();
    StackEntry {
        thread_name,
        frames,
    }
}

#[derive(Debug)]
struct MemoryTypeInfo {
    initial: u64,
    #[allow(dead_code)]
    maximum: Option<u64>,
}

fn parse_memory_section(data: &[u8]) -> Vec<MemoryTypeInfo> {
    let mut r = WasmReader::new(data);
    let count = r.read_u32_leb128();
    (0..count)
        .map(|_| {
            let flags = r.read_u8();
            let has_max = flags & 0x01 != 0;
            let initial = r.read_u32_leb128() as u64;
            let maximum = if has_max {
                Some(r.read_u32_leb128() as u64)
            } else {
                None
            };
            MemoryTypeInfo { initial, maximum }
        })
        .collect()
}

#[derive(Debug)]
struct DataSegment {
    memory_index: u32,
    offset: u64,
    data: Vec<u8>,
}

fn read_const_expr_value(r: &mut WasmReader) -> i64 {
    let opcode = r.read_u8();
    let value = match opcode {
        0x41 => r.read_i32_leb128() as i64,
        0x42 => r.read_i64_leb128(),
        _ => panic!("unexpected opcode in const expr: 0x{opcode:02x}"),
    };
    assert_eq!(r.read_u8(), 0x0B, "expected end opcode in const expr");
    value
}

fn parse_data_section(data: &[u8]) -> Vec<DataSegment> {
    let mut r = WasmReader::new(data);
    let count = r.read_u32_leb128();
    let mut segments = Vec::new();
    for _ in 0..count {
        let flags = r.read_u32_leb128();
        match flags {
            0 => {
                let offset = read_const_expr_value(&mut r) as u64;
                let len = r.read_u32_leb128() as usize;
                let bytes = r.read_bytes(len).to_vec();
                segments.push(DataSegment {
                    memory_index: 0,
                    offset,
                    data: bytes,
                });
            }
            2 => {
                let memory_index = r.read_u32_leb128();
                let offset = read_const_expr_value(&mut r) as u64;
                let len = r.read_u32_leb128() as usize;
                let bytes = r.read_bytes(len).to_vec();
                segments.push(DataSegment {
                    memory_index,
                    offset,
                    data: bytes,
                });
            }
            _ => panic!("unexpected data segment flags: {flags}"),
        }
    }
    segments
}

fn parse_global_section(data: &[u8]) -> Vec<CoredumpValue> {
    let mut r = WasmReader::new(data);
    let count = r.read_u32_leb128();
    (0..count)
        .map(|_| {
            let valtype = r.read_u8();
            let _mutability = r.read_u8();
            match valtype {
                0x7F => {
                    assert_eq!(r.read_u8(), 0x41);
                    let v = r.read_i32_leb128();
                    assert_eq!(r.read_u8(), 0x0B);
                    CoredumpValue::I32(v)
                }
                0x7E => {
                    assert_eq!(r.read_u8(), 0x42);
                    let v = r.read_i64_leb128();
                    assert_eq!(r.read_u8(), 0x0B);
                    CoredumpValue::I64(v)
                }
                0x7D => {
                    assert_eq!(r.read_u8(), 0x43);
                    let v = r.read_f32_bytes();
                    assert_eq!(r.read_u8(), 0x0B);
                    CoredumpValue::F32(v)
                }
                0x7C => {
                    assert_eq!(r.read_u8(), 0x44);
                    let v = r.read_f64_bytes();
                    assert_eq!(r.read_u8(), 0x0B);
                    CoredumpValue::F64(v)
                }
                _ => panic!("unknown global valtype: 0x{valtype:02x}"),
            }
        })
        .collect()
}

#[derive(Debug)]
struct ParsedCoredump {
    process_info: Option<ProcessInfo>,
    modules: Option<Vec<ModuleEntry>>,
    instances: Option<Vec<InstanceEntry>>,
    stacks: Vec<StackEntry>,
    memory_types: Vec<MemoryTypeInfo>,
    data_segments: Vec<DataSegment>,
    globals: Vec<CoredumpValue>,
}

fn parse_coredump(bytes: &[u8]) -> ParsedCoredump {
    // Validate actual standard Wasm structure, then retain the original binary.
    wasmparser::Validator::new().validate_all(bytes).expect("actual coredump must validate as Wasm");
    if let Ok(directory) = std::env::var("WASMI_DUMP_OUTPUT") {
        std::fs::create_dir_all(&directory).unwrap();
        let thread = std::thread::current();
        let name = thread.name().unwrap_or("native-contract");
        std::fs::write(std::path::Path::new(&directory).join(format!("{name}.wasm")), bytes).unwrap();
    }
    let sections = parse_wasm_sections(bytes);
    let mut result = ParsedCoredump {
        process_info: None,
        modules: None,
        instances: None,
        stacks: Vec::new(),
        memory_types: Vec::new(),
        data_segments: Vec::new(),
        globals: Vec::new(),
    };
    for section in &sections {
        match section.id {
            0 => {
                let (name, custom_data) = get_custom_section_data(section);
                match name.as_str() {
                    "core" => result.process_info = Some(parse_core_section(custom_data)),
                    "coremodules" => {
                        result.modules = Some(parse_coremodules_section(custom_data))
                    }
                    "coreinstances" => {
                        result.instances = Some(parse_coreinstances_section(custom_data))
                    }
                    "corestack" => result.stacks.push(parse_corestack_section(custom_data)),
                    _ => {}
                }
            }
            5 => result.memory_types = parse_memory_section(&section.data),
            6 => result.globals = parse_global_section(&section.data),
            11 => result.data_segments = parse_data_section(&section.data),
            _ => {}
        }
    }
    result
}

fn reconstruct_memory(segments: &[DataSegment], memory_index: u32, size: usize) -> Vec<u8> {
    let mut memory = vec![0u8; size];
    for seg in segments {
        if seg.memory_index == memory_index {
            let start = seg.offset as usize;
            let end = start + seg.data.len();
            if end <= memory.len() {
                memory[start..end].copy_from_slice(&seg.data);
            }
        }
    }
    memory
}

fn coredump_engine() -> Engine {
    let mut config = Config::default();
    config.generate_coredump(true);
    Engine::new(&config)
}

fn coredump_engine_with_name(name: &str) -> Engine {
    let mut config = Config::default();
    config.generate_coredump(true);
    config.coredump_executable_name(name);
    Engine::new(&config)
}

fn trap_with_coredump(engine: &Engine, wat: &str) -> (Error, ParsedCoredump) {
    let module = Module::new(engine, wat).unwrap();
    let mut store = Store::new(engine, ());
    let linker = <Linker<()>>::new(engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance.get_typed_func::<(), ()>(&store, "trap").unwrap();
    let err = func.call(&mut store, ()).unwrap_err();
    let bytes = err.coredump().expect("coredump should be present");
    let coredump = parse_coredump(bytes);
    (err, coredump)
}

#[test]
fn coredump_produces_valid_wasm_with_required_sections() {
    let engine = coredump_engine();
    let (_, coredump) = trap_with_coredump(
        &engine,
        r#"(module (func (export "trap") unreachable))"#,
    );
    assert!(coredump.process_info.is_some(), "missing 'core' section");
    assert!(
        coredump.modules.is_some(),
        "missing 'coremodules' section"
    );
    assert!(
        coredump.instances.is_some(),
        "missing 'coreinstances' section"
    );
    assert_eq!(coredump.stacks.len(), 1);
}

#[test]
fn coredump_default_executable_name() {
    let engine = coredump_engine();
    let (_, coredump) = trap_with_coredump(
        &engine,
        r#"(module (func (export "trap") unreachable))"#,
    );
    let info = coredump.process_info.unwrap();
    assert_eq!(
        info.executable_name, "",
        "default executable name should be empty"
    );
}

#[test]
fn coredump_custom_executable_name() {
    let engine = coredump_engine_with_name("my-app.wasm");
    let (_, coredump) = trap_with_coredump(
        &engine,
        r#"(module (func (export "trap") unreachable))"#,
    );
    let info = coredump.process_info.unwrap();
    assert_eq!(info.executable_name, "my-app.wasm");
}

#[test]
fn coredump_single_frame_unreachable() {
    let engine = coredump_engine();
    let (_, coredump) = trap_with_coredump(
        &engine,
        r#"
        (module
            (func (export "trap") unreachable)
        )
    "#,
    );
    assert_eq!(coredump.stacks.len(), 1);
    let _ = &coredump.stacks[0].thread_name; // parsed successfully
    let frames = &coredump.stacks[0].frames;
    assert_eq!(frames.len(), 1, "should have exactly one frame");
    assert_eq!(frames[0].func_index, 0, "function index should be 0");
    assert_eq!(frames[0].instance_index, 0);
    let _ = frames[0].code_offset; // code_offset is a valid u32 (0 when unavailable)
}

#[test]
fn coredump_nested_calls_youngest_to_oldest() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (func $a (export "trap") (call $b))
            (func $b (call $c))
            (func $c unreachable)
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    assert_eq!(coredump.stacks.len(), 1);
    let frames = &coredump.stacks[0].frames;
    assert_eq!(frames.len(), 3, "should have 3 frames for nested calls");
    assert_eq!(
        frames[0].func_index, 2,
        "youngest frame: func $c (index 2)"
    );
    assert_eq!(frames[1].func_index, 1, "middle frame: func $b (index 1)");
    assert_eq!(
        frames[2].func_index, 0,
        "oldest frame: func $a (index 0)"
    );
}

#[test]
fn coredump_nested_frame_locals() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (func $outer (export "trap") (param i32) (local i32)
                (local.set 1 (i32.const 42))
                (call $inner (i64.const 999))
            )
            (func $inner (param i64)
                unreachable
            )
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance
        .get_typed_func::<i32, ()>(&store, "trap")
        .unwrap();
    let err = func.call(&mut store, 7).unwrap_err();
    let coredump = parse_coredump(err.coredump().unwrap());

    let frames = &coredump.stacks[0].frames;
    assert_eq!(frames.len(), 2);
    assert_eq!(frames[0].locals.len(), 1, "inner frame: 1 i64 param");
    assert_eq!(frames[0].locals[0], CoredumpValue::I64(999));
    assert_eq!(frames[1].locals.len(), 2, "outer frame: 1 param + 1 local");
    assert_eq!(frames[1].locals[0], CoredumpValue::I32(7), "outer param");
    assert_eq!(
        frames[1].locals[1],
        CoredumpValue::I32(42),
        "outer local"
    );
}

#[test]
fn coredump_captures_i32_i64_locals() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (func (export "trap") (param i32) (param i64) (local i32) (local i64)
                (local.set 2 (i32.const 42))
                (local.set 3 (i64.const 1234567890123))
                unreachable
            )
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance
        .get_typed_func::<(i32, i64), ()>(&store, "trap")
        .unwrap();
    let err = func.call(&mut store, (10, 99i64)).unwrap_err();
    let coredump = parse_coredump(err.coredump().unwrap());

    let frame = &coredump.stacks[0].frames[0];
    assert_eq!(frame.locals.len(), 4, "should have 2 params + 2 locals");
    assert_eq!(frame.locals[0], CoredumpValue::I32(10), "param 0");
    assert_eq!(frame.locals[1], CoredumpValue::I64(99), "param 1");
    assert_eq!(frame.locals[2], CoredumpValue::I32(42), "local 0");
    assert_eq!(
        frame.locals[3],
        CoredumpValue::I64(1234567890123),
        "local 1"
    );
}

#[test]
fn coredump_captures_f32_f64_locals() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (func (export "trap") (local f32) (local f64)
                (local.set 0 (f32.const 1.5))
                (local.set 1 (f64.const 2.5))
                unreachable
            )
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    let frame = &coredump.stacks[0].frames[0];
    assert_eq!(frame.locals.len(), 2);
    assert_eq!(frame.locals[0], CoredumpValue::F32(1.5f32.to_bits()));
    assert_eq!(frame.locals[1], CoredumpValue::F64(2.5f64.to_bits()));
}

#[test]
fn coredump_captures_memory_contents() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (memory (export "mem") 1)
            (func (export "trap")
                (i32.store (i32.const 0) (i32.const 0xDEADBEEF))
                (i32.store (i32.const 100) (i32.const 0xCAFEBABE))
                unreachable
            )
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    assert_eq!(coredump.memory_types.len(), 1);
    assert_eq!(coredump.memory_types[0].initial, 1);

    let page_size = 65536usize;
    let mem_size = coredump.memory_types[0].initial as usize * page_size;
    let mem = reconstruct_memory(&coredump.data_segments, 0, mem_size);
    assert_eq!(&mem[0..4], &0xDEADBEEFu32.to_le_bytes());
    assert_eq!(&mem[100..104], &0xCAFEBABEu32.to_le_bytes());
}

#[test]
fn coredump_captures_mutable_global_current_value() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (global $g (mut i32) (i32.const 0))
            (func (export "trap")
                (global.set $g (i32.const 99))
                unreachable
            )
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    assert_eq!(coredump.globals.len(), 1);
    assert_eq!(
        coredump.globals[0],
        CoredumpValue::I32(99),
        "should capture current value, not initial"
    );
}

#[test]
fn coredump_captures_i64_global() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (global $g (mut i64) (i64.const 0))
            (func (export "trap")
                (global.set $g (i64.const 0x1234567890))
                unreachable
            )
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    assert_eq!(coredump.globals.len(), 1);
    assert_eq!(
        coredump.globals[0],
        CoredumpValue::I64(0x1234567890),
        "should capture i64 global current value"
    );
}

#[test]
fn coredump_captures_f32_f64_globals() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (global $gf (mut f32) (f32.const 0))
            (global $gd (mut f64) (f64.const 0))
            (func (export "trap")
                (global.set $gf (f32.const 3.14))
                (global.set $gd (f64.const 2.718281828))
                unreachable
            )
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    assert_eq!(coredump.globals.len(), 2);
    assert_eq!(
        coredump.globals[0],
        CoredumpValue::F32(3.14f32.to_bits()),
        "should capture f32 global"
    );
    assert_eq!(
        coredump.globals[1],
        CoredumpValue::F64(2.718281828f64.to_bits()),
        "should capture f64 global"
    );
}

#[test]
fn coredump_on_integer_division_by_zero() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (func (export "trap") (result i32)
                (i32.div_s (i32.const 1) (i32.const 0))
            )
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance
        .get_typed_func::<(), i32>(&store, "trap")
        .unwrap();
    let err = func.call(&mut store, ()).unwrap_err();
    let coredump_bytes = err
        .coredump()
        .expect("div by zero should produce coredump");
    let coredump = parse_coredump(coredump_bytes);
    assert_eq!(coredump.stacks.len(), 1);
    assert_eq!(coredump.stacks[0].frames.len(), 1);
}

#[test]
fn coredump_on_memory_out_of_bounds() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (memory 1)
            (func (export "trap") (result i32)
                (i32.load (i32.const 0xFFFFFF))
            )
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance
        .get_typed_func::<(), i32>(&store, "trap")
        .unwrap();
    let err = func.call(&mut store, ()).unwrap_err();
    let coredump_bytes = err
        .coredump()
        .expect("memory OOB should produce coredump");
    let coredump = parse_coredump(coredump_bytes);
    assert_eq!(coredump.stacks.len(), 1);
    assert_eq!(coredump.stacks[0].frames.len(), 1);
}

#[test]
fn coredump_excludes_host_function_frames() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (import "env" "host_call_back" (func $host_call_back))
            (func $caller (export "caller")
                (call $host_call_back)
            )
            (func $trap_fn (export "trap_fn")
                unreachable
            )
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let mut linker = <Linker<()>>::new(&engine);
    linker
        .func_wrap(
            "env",
            "host_call_back",
            |mut caller: Caller<'_, ()>| -> Result<(), Error> {
                let trap_fn = match caller.get_export("trap_fn") {
                    Some(Extern::Func(f)) => f,
                    _ => panic!("trap_fn export not found"),
                };
                trap_fn.call(&mut caller, &[], &mut [])?;
                Ok(())
            },
        )
        .unwrap();
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let caller_fn = instance
        .get_typed_func::<(), ()>(&store, "caller")
        .unwrap();
    let err = caller_fn.call(&mut store, ()).unwrap_err();
    let coredump = parse_coredump(err.coredump().expect("should have coredump"));

    let frames = &coredump.stacks[0].frames;
    assert_eq!(
        frames.len(),
        2,
        "should have 2 wasm frames, host frame excluded"
    );
    assert_eq!(frames[0].func_index, 2, "youngest: trap_fn (index 2)");
    assert_eq!(frames[1].func_index, 1, "oldest: caller (index 1)");
}

#[test]
fn coredump_instance_references_memory_and_globals() {
    let engine = coredump_engine();
    let wat = r#"
        (module
            (memory (export "mem") 1)
            (global (export "g1") (mut i32) (i32.const 10))
            (global (export "g2") (mut i64) (i64.const 20))
            (func (export "trap") unreachable)
        )
    "#;
    let (_, coredump) = trap_with_coredump(&engine, wat);
    let instances = coredump.instances.unwrap();
    assert_eq!(instances.len(), 1);
    assert_eq!(instances[0].module_index, 0);
    assert_eq!(
        instances[0].memory_indices.len(),
        1,
        "should reference 1 memory"
    );
    assert_eq!(
        instances[0].global_indices.len(),
        2,
        "should reference 2 globals"
    );
}

#[test]
fn coredump_multiple_memories() {
    let mut config = Config::default();
    config.generate_coredump(true);
    config.wasm_multi_memory(true);
    let engine = Engine::new(&config);
    let wat = r#"
        (module
            (memory $m0 (export "mem0") 1)
            (memory $m1 (export "mem1") 2)
            (func (export "trap") unreachable)
        )
    "#;
    let module = Module::new(&engine, wat).unwrap();
    let mut store = Store::new(&engine, ());
    let linker = <Linker<()>>::new(&engine);
    let instance = linker.instantiate_and_start(&mut store, &module).unwrap();
    let func = instance
        .get_typed_func::<(), ()>(&store, "trap")
        .unwrap();
    let err = func.call(&mut store, ()).unwrap_err();
    let coredump = parse_coredump(err.coredump().unwrap());

    assert_eq!(
        coredump.memory_types.len(),
        2,
        "should capture both memories"
    );
    assert_eq!(coredump.memory_types[0].initial, 1);
    assert_eq!(coredump.memory_types[1].initial, 2);

    let instances = coredump.instances.unwrap();
    assert_eq!(
        instances[0].memory_indices.len(),
        2,
        "instance should reference both memories"
    );
}


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
