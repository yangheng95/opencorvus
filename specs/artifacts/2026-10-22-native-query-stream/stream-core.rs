    type ScopeOutput = Arc<Mutex<std::io::Stdout>>;

    #[derive(Serialize)]
    struct QueryStreamSummary {
        bytes: usize,
        chunks: u64,
    }

    fn emit_query_frame(output: &ScopeOutput, value: serde_json::Value) -> Result<(), String> {
        let mut output = output.lock().map_err(|_| "scope output poisoned")?;
        serde_json::to_writer(&mut *output, &value)
            .map_err(|error| format!("scope frame write failed: {error}"))?;
        output.write_all(b"\n").and_then(|_| output.flush())
            .map_err(|error| format!("scope frame flush failed: {error}"))
    }

    fn collect_query_bytes(
        mut input: fs::File,
        activity: Arc<QueryActivity>,
        maximum: usize,
        request_id: String,
        stream: &'static str,
        output: ScopeOutput,
    ) -> Result<QueryStreamSummary, String> {
        let mut summary = QueryStreamSummary { bytes: 0, chunks: 0 };
        let mut chunk = [0u8; 16384];
        loop {
            let count = input.read(&mut chunk).map_err(|error| format!("query pipe read failed: {error}"))?;
            if count == 0 {
                emit_query_frame(&output, serde_json::json!({
                    "kind": "stream_end", "request_id": request_id, "stream": stream,
                    "sequence": summary.chunks, "offset": summary.bytes,
                }))?;
                return Ok(summary);
            }
            // Activity belongs to actual target bytes, never control frames.
            activity.last.store(activity.start.elapsed().as_millis() as u64, Ordering::Release);
            let previous = activity.bytes.fetch_add(count, Ordering::AcqRel);
            let retained = count.min(maximum.saturating_sub(previous));
            if retained > 0 {
                if let Err(error) = emit_query_frame(&output, serde_json::json!({
                    "kind": "data", "request_id": request_id, "stream": stream,
                    "sequence": summary.chunks, "offset": summary.bytes, "bytes": &chunk[..retained],
                })) {
                    *activity.reason.lock().unwrap() = Some("output_delivery_error".into());
                    return Err(error);
                }
                summary.bytes += retained;
                summary.chunks += 1;
            }
            if previous.saturating_add(count) > maximum {
                *activity.reason.lock().unwrap() = Some("output_limit".into());
            }
        }
    }

    fn execute_scope_query(query: ScopeQuery, output_frames: ScopeOutput) -> serde_json::Value {
        let (request_id, cancel_file) = match &query.request {
            Request::Command { request_id, cancel_file, detached: false, .. } =>
                (request_id.clone(), cancel_file.clone()),
            _ => return serde_json::json!({"kind":"terminal", "error":"query_scope_requires_owned_command"}),
        };
        let execute = || -> Result<serde_json::Value, String> {
            let (stdout, output) = scope_pipe()?;
            let (stderr, error) = scope_pipe()?;
            let input = fs::OpenOptions::new().read(true).open("NUL")
                .map_err(|error| format!("NUL open failed: {error}"))?;
            if unsafe { SetHandleInformation(input.as_raw_handle(), HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) } == 0 {
                return Err(format!("NUL inherit failed {}", unsafe { GetLastError() }));
            }
            let mut environment: Vec<_> = env::vars_os()
                .filter(|(key, _)| !key.to_string_lossy().eq_ignore_ascii_case("GIT_CEILING_DIRECTORIES"))
                .collect();
            environment.push(("GIT_CEILING_DIRECTORIES".into(), query.ceiling.into()));
            environment.sort_by_key(|(key, _)| key.to_string_lossy().to_uppercase());
            let mut block = Vec::new();
            for (key, value) in environment {
                block.extend(key.encode_wide()); block.push('=' as u16);
                block.extend(value.encode_wide()); block.push(0);
            }
            block.push(0);
            let activity = Arc::new(QueryActivity {
                start: Instant::now(), last: AtomicU64::new(0), bytes: AtomicUsize::new(0), reason: Mutex::new(None),
            });
            let finished = Arc::new(AtomicBool::new(false));
            let stdout = {
                let activity = activity.clone(); let output_frames = output_frames.clone(); let id = request_id.clone();
                std::thread::spawn(move || collect_query_bytes(stdout, activity, query.max_output_bytes, id, "stdout", output_frames))
            };
            let stderr = {
                let activity = activity.clone(); let output_frames = output_frames.clone(); let id = request_id.clone();
                std::thread::spawn(move || collect_query_bytes(stderr, activity, query.max_output_bytes, id, "stderr", output_frames))
            };
            let monitor = {
                let activity = activity.clone(); let finished = finished.clone();
                std::thread::spawn(move || -> Result<(), String> {
                    while !finished.load(Ordering::Acquire) {
                        let now = activity.start.elapsed().as_millis() as u64;
                        if now.saturating_sub(activity.last.load(Ordering::Acquire)) >= query.inactivity_timeout_ms {
                            let mut reason = activity.reason.lock().unwrap();
                            if reason.is_none() { *reason = Some("inactivity_timeout".into()); }
                        }
                        if activity.reason.lock().unwrap().is_some() {
                            fs::write(&cancel_file, b"scope-query-control")
                                .map_err(|error| format!("cancel publish failed: {error}"))?;
                            return Ok(());
                        }
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                    Ok(())
                })
            };
            let native = run_request_with_io(query.request, Some(ScopeIo { input, output, error, environment: block }));
            let stdout = stdout.join().map_err(|_| "stdout reader panicked")?;
            let stderr = stderr.join().map_err(|_| "stderr reader panicked")?;
            finished.store(true, Ordering::Release);
            let monitor = monitor.join().map_err(|_| "inactivity monitor panicked")?;
            let mut failures = Vec::new();
            if let Err(error) = &native { failures.push(error.clone()); }
            if let Err(error) = &stdout { failures.push(error.clone()); }
            if let Err(error) = &stderr { failures.push(error.clone()); }
            if let Err(error) = monitor { failures.push(error); }
            let reason = activity.reason.lock().unwrap().clone();
            let delivered = stdout.is_ok() && stderr.is_ok();
            Ok(serde_json::json!({
                "kind":"terminal", "request_id":request_id, "code":native.ok(),
                "error":reason, "native_errors":failures,
                "streams":{"stdout":stdout.ok(), "stderr":stderr.ok()},
                "output_joined":true, "output_delivery_complete":delivered,
            }))
        };
        match execute() {
            Ok(value) => value,
            Err(error) => serde_json::json!({"kind":"terminal", "request_id":request_id, "error":error}),
        }
    }

    fn query_scope() -> Result<(), String> {
        let mut workers = Vec::new();
        let mut seen = std::collections::BTreeSet::new();
        let output = Arc::new(Mutex::new(std::io::stdout()));
        for line in std::io::stdin().lock().lines() {
            let line = line.map_err(|error| format!("scope input failed: {error}"))?;
            let query: ScopeQuery = serde_json::from_str(&line)
                .map_err(|error| format!("scope request parse failed: {error}"))?;
            let id = match &query.request {
                Request::Command { request_id, detached: false, .. } => request_id.clone(),
                _ => return Err("scope requires owned command".into()),
            };
            if !seen.insert(id) { return Err("scope duplicate request identity".into()); }
            let output = output.clone();
            workers.push(std::thread::spawn(move || -> Result<(), String> {
                let result = execute_scope_query(query, output.clone());
                emit_query_frame(&output, result)
            }));
        }
        let failures: Vec<_> = workers.into_iter().filter_map(|worker| match worker.join() {
            Ok(Ok(())) => None, Ok(Err(error)) => Some(error), Err(_) => Some("scope query panicked".into()),
        }).collect();
        if failures.is_empty() { Ok(()) } else { Err(failures.join("; ")) }
    }
