use ignore::{DirEntry, WalkBuilder, WalkState};
use std::{
    error::Error,
    ffi::OsStr,
    io::{self, Write},
    path::Path,
    sync::Mutex,
};

fn write_entry(
    entry: Result<DirEntry, ignore::Error>,
    root: &Path,
    output: &Mutex<io::BufWriter<io::Stdout>>,
) -> Result<(), Box<dyn Error>> {
    let entry = entry?;
    if let Some(error) = entry.error() {
        eprintln!("{error}");
    }
    if entry.depth() == 0 {
        return Ok(());
    }
    let Some(kind) = entry.file_type() else {
        return Ok(());
    };
    let tag = if kind.is_dir() {
        b'd'
    } else if kind.is_file() {
        b'f'
    } else {
        return Ok(());
    };
    let relative = entry.path().strip_prefix(root)?;
    let name = relative
        .to_str()
        .ok_or("project path is not valid Unicode")?;
    let mut output = output
        .lock()
        .map_err(|_| "project index output lock poisoned")?;
    output.write_all(&[tag])?;
    output.write_all(name.as_bytes())?;
    output.write_all(&[0])?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let root = Path::new(".");
    let mut walker = WalkBuilder::new(root);
    walker
        .hidden(false)
        .follow_links(false)
        .add_custom_ignore_filename(".rgignore")
        .filter_entry(|entry| entry.depth() == 0 || entry.file_name() != OsStr::new(".git"));

    let output = Mutex::new(io::BufWriter::new(io::stdout()));
    let failure = Mutex::new(None::<String>);
    walker.build_parallel().run(|| {
        let output = &output;
        let failure = &failure;
        Box::new(move |entry| match write_entry(entry, root, output) {
            Ok(()) => WalkState::Continue,
            Err(error) => {
                let mut failure = failure.lock().expect("project index failure lock poisoned");
                failure.get_or_insert_with(|| error.to_string());
                WalkState::Quit
            }
        })
    });
    if let Some(error) = failure.into_inner()? {
        return Err(error.into());
    }
    output.into_inner()?.flush()?;
    Ok(())
}
