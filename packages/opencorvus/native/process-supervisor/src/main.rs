#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod windows_helper {
    use serde::{Deserialize, Serialize};
    use std::{
        env,
        ffi::c_void,
        fs,
        os::windows::ffi::OsStrExt,
        path::PathBuf,
        ptr::{null, null_mut},
    };
    use windows_sys::Win32::{
        Foundation::{
            CloseHandle, GetLastError, ERROR_INVALID_PARAMETER, ERROR_NO_MORE_FILES, HANDLE,
            INVALID_HANDLE_VALUE, WAIT_OBJECT_0, WAIT_TIMEOUT,
        },
        System::{
            Console::{GetStdHandle, STD_ERROR_HANDLE, STD_INPUT_HANDLE, STD_OUTPUT_HANDLE},
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            JobObjects::{
                CreateJobObjectW, JobObjectBasicAccountingInformation,
                JobObjectExtendedLimitInformation, QueryInformationJobObject,
                SetInformationJobObject, TerminateJobObject,
                JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
            Threading::{
                CreateProcessW, DeleteProcThreadAttributeList, GetCurrentProcessId,
                GetExitCodeProcess, InitializeProcThreadAttributeList, OpenProcess, ResumeThread,
                Sleep, TerminateProcess, UpdateProcThreadAttribute, WaitForSingleObject,
                CREATE_BREAKAWAY_FROM_JOB, CREATE_NO_WINDOW, CREATE_SUSPENDED,
                CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT, PROCESS_INFORMATION,
                PROCESS_SYNCHRONIZE, PROCESS_TERMINATE, PROC_THREAD_ATTRIBUTE_JOB_LIST,
                STARTF_USESTDHANDLES, STARTUPINFOEXW,
            },
        },
    };

    #[derive(Deserialize)]
    #[serde(tag = "kind", rename_all = "snake_case")]
    enum Request {
        Shell {
            command: String,
            shell: String,
            cwd: Option<String>,
            cancel_file: String,
            ready_file: String,
            settled_file: String,
            request_id: String,
            owner_pid: u32,
            owner_process_instance_id: String,
            runtime_occurrence_id: String,
        },
        Command {
            executable: String,
            args: Vec<String>,
            #[serde(default)]
            detached: bool,
            cwd: Option<String>,
            cancel_file: String,
            ready_file: String,
            settled_file: String,
            request_id: String,
            owner_pid: u32,
            owner_process_instance_id: String,
            runtime_occurrence_id: String,
        },
    }

    struct LaunchRequest {
        application: String,
        command_line: String,
        cwd: Option<String>,
        cancel_file: String,
        ready_file: String,
        settled_file: String,
        request_id: String,
        owner_pid: u32,
        owner_process_instance_id: String,
        runtime_occurrence_id: String,
        detached: bool,
    }

    #[derive(Serialize)]
    struct ReadyMarker<'a> {
        protocol: u32,
        request_id: &'a str,
        helper_pid: u32,
        target_pid: u32,
        runtime_occurrence_id: &'a str,
    }

    #[derive(Serialize)]
    struct SettlementMarker<'a> {
        protocol: u32,
        request_id: &'a str,
        helper_pid: u32,
        target_pid: u32,
        active_processes: u32,
        runtime_occurrence_id: &'a str,
    }

    #[derive(Clone)]
    struct ProcessInfo {
        pid: u32,
        parent_pid: u32,
    }

    struct Handle(HANDLE);

    impl Drop for Handle {
        fn drop(&mut self) {
            if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    struct ProcessThreadAttributeList {
        _storage: Vec<usize>,
        _jobs: Box<[HANDLE]>,
        pointer: *mut c_void,
    }

    impl ProcessThreadAttributeList {
        fn for_job(job: HANDLE) -> Result<Self, String> {
            let mut byte_count = 0usize;
            unsafe {
                InitializeProcThreadAttributeList(null_mut(), 1, 0, &mut byte_count);
            }
            if byte_count == 0 {
                let error = unsafe { GetLastError() };
                return Err(format!(
                    "InitializeProcThreadAttributeList size query failed (win32={error})"
                ));
            }

            let word_count = byte_count.div_ceil(std::mem::size_of::<usize>());
            let mut storage = vec![0usize; word_count];
            let pointer = storage.as_mut_ptr() as *mut c_void;
            let initialized =
                unsafe { InitializeProcThreadAttributeList(pointer, 1, 0, &mut byte_count) };
            if initialized == 0 {
                let error = unsafe { GetLastError() };
                return Err(format!(
                    "InitializeProcThreadAttributeList failed (win32={error})"
                ));
            }

            let jobs: Box<[HANDLE]> = vec![job].into_boxed_slice();
            let updated = unsafe {
                UpdateProcThreadAttribute(
                    pointer,
                    0,
                    PROC_THREAD_ATTRIBUTE_JOB_LIST as usize,
                    jobs.as_ptr() as *const c_void,
                    std::mem::size_of_val(jobs.as_ref()),
                    null_mut(),
                    null(),
                )
            };
            if updated == 0 {
                let error = unsafe { GetLastError() };
                unsafe {
                    DeleteProcThreadAttributeList(pointer);
                }
                return Err(format!(
                    "UpdateProcThreadAttribute(PROC_THREAD_ATTRIBUTE_JOB_LIST) failed (win32={error})"
                ));
            }
            Ok(Self {
                _storage: storage,
                _jobs: jobs,
                pointer,
            })
        }
    }

    impl Drop for ProcessThreadAttributeList {
        fn drop(&mut self) {
            unsafe {
                DeleteProcThreadAttributeList(self.pointer);
            }
        }
    }

    struct SuspendedTarget {
        job: Option<Handle>,
        process: Handle,
        thread: Handle,
        pid: u32,
    }

    struct StandardHandles {
        input: HANDLE,
        output: HANDLE,
        error: HANDLE,
    }

    fn inherited_standard_handles() -> Result<StandardHandles, String> {
        let handles = StandardHandles {
            input: unsafe { GetStdHandle(STD_INPUT_HANDLE) },
            output: unsafe { GetStdHandle(STD_OUTPUT_HANDLE) },
            error: unsafe { GetStdHandle(STD_ERROR_HANDLE) },
        };
        for (label, handle) in [
            ("stdin", handles.input),
            ("stdout", handles.output),
            ("stderr", handles.error),
        ] {
            if handle.is_null() || handle == INVALID_HANDLE_VALUE {
                let error = unsafe { GetLastError() };
                return Err(format!(
                    "Windows supervisor {label} handle is unavailable (win32={error})"
                ));
            }
        }
        Ok(handles)
    }

    fn wide_null(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn quote_arg(value: &str) -> String {
        if value.is_empty() {
            return "\"\"".to_string();
        }
        let needs_quotes = value.chars().any(|c| c.is_whitespace() || c == '"');
        if !needs_quotes {
            return value.to_string();
        }
        let mut out = String::from("\"");
        let mut backslashes = 0;
        for ch in value.chars() {
            if ch == '\\' {
                backslashes += 1;
                continue;
            }
            if ch == '"' {
                out.push_str(&"\\".repeat(backslashes * 2 + 1));
                out.push('"');
                backslashes = 0;
                continue;
            }
            out.push_str(&"\\".repeat(backslashes));
            backslashes = 0;
            out.push(ch);
        }
        out.push_str(&"\\".repeat(backslashes * 2));
        out.push('"');
        out
    }

    fn shell_args(shell: &str, command: &str) -> Vec<String> {
        let name = PathBuf::from(shell)
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        match name.as_str() {
            "cmd" => vec!["/d".into(), "/s".into(), "/c".into(), command.into()],
            "powershell" | "pwsh" => vec!["-NoProfile".into(), "-Command".into(), command.into()],
            _ => vec!["-c".into(), command.into()],
        }
    }

    fn create_job() -> Result<Handle, String> {
        let job = unsafe { CreateJobObjectW(null(), null()) };
        if job.is_null() || job == INVALID_HANDLE_VALUE {
            return Err("CreateJobObjectW failed".into());
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = unsafe {
            SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if ok == 0 {
            unsafe {
                CloseHandle(job);
            }
            return Err("SetInformationJobObject(KILL_ON_JOB_CLOSE) failed".into());
        }
        Ok(Handle(job))
    }

    fn job_active_process_count(job: HANDLE) -> Result<u32, String> {
        let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { std::mem::zeroed() };
        let queried = unsafe {
            QueryInformationJobObject(
                job,
                JobObjectBasicAccountingInformation,
                &mut info as *mut _ as *mut c_void,
                std::mem::size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                null_mut(),
            )
        };
        if queried == 0 {
            let error = unsafe { GetLastError() };
            return Err(format!(
                "QueryInformationJobObject(active-process-zero) failed (win32={error})"
            ));
        }
        Ok(info.ActiveProcesses)
    }

    fn cancellation_requested(cancel_file: &str) -> bool {
        std::path::Path::new(cancel_file).exists()
    }

    fn terminate_job_once(job: HANDLE, cancellation_applied: &mut bool) -> Result<(), String> {
        if *cancellation_applied {
            return Ok(());
        }
        let terminated = unsafe { TerminateJobObject(job, 1) };
        if terminated == 0 {
            let error = unsafe { GetLastError() };
            return Err(format!("TerminateJobObject failed (win32={error})"));
        }
        *cancellation_applied = true;
        Ok(())
    }

    fn wait_for_job_active_process_zero(
        job: HANDLE,
        cancel_file: &str,
        owner: Option<HANDLE>,
        cancellation_applied: &mut bool,
    ) -> Result<(), String> {
        loop {
            if job_active_process_count(job)? == 0 {
                return Ok(());
            }
            let owner_dead = owner
                .map(|handle| unsafe { WaitForSingleObject(handle, 0) } == WAIT_OBJECT_0)
                .unwrap_or(false);
            if owner_dead || cancellation_requested(cancel_file) {
                terminate_job_once(job, cancellation_applied)?;
            }
            unsafe { Sleep(10) };
        }
    }

    fn launch_request(request: Request) -> LaunchRequest {
        match request {
            Request::Shell {
                command,
                shell,
                cwd,
                cancel_file,
                ready_file,
                settled_file,
                request_id,
                owner_pid,
                owner_process_instance_id,
                runtime_occurrence_id,
            } => {
                let args = shell_args(&shell, &command);
                let command_line = std::iter::once(shell.as_str())
                    .chain(args.iter().map(String::as_str))
                    .map(quote_arg)
                    .collect::<Vec<_>>()
                    .join(" ");
                LaunchRequest {
                    application: shell,
                    command_line,
                    cwd,
                    cancel_file,
                    ready_file,
                    settled_file,
                    request_id,
                    owner_pid,
                    owner_process_instance_id,
                    runtime_occurrence_id,
                    detached: false,
                }
            }
            Request::Command {
                executable,
                args,
                detached,
                cwd,
                cancel_file,
                ready_file,
                settled_file,
                request_id,
                owner_pid,
                owner_process_instance_id,
                runtime_occurrence_id,
            } => {
                let command_line = std::iter::once(executable.as_str())
                    .chain(args.iter().map(String::as_str))
                    .map(quote_arg)
                    .collect::<Vec<_>>()
                    .join(" ");
                LaunchRequest {
                    application: executable,
                    command_line,
                    cwd,
                    cancel_file,
                    ready_file,
                    settled_file,
                    request_id,
                    owner_pid,
                    owner_process_instance_id,
                    runtime_occurrence_id,
                    detached,
                }
            }
        }
    }

    fn create_suspended_target(
        request: &LaunchRequest,
        standard_handles: Option<&StandardHandles>,
    ) -> Result<SuspendedTarget, String> {
        let job = if request.detached {
            None
        } else {
            Some(create_job()?)
        };
        let (process, thread, pid) =
            create_suspended_process(request, standard_handles, job.as_ref().map(|job| job.0))?;
        Ok(SuspendedTarget {
            job,
            process,
            thread,
            pid,
        })
    }

    fn create_suspended_process(
        request: &LaunchRequest,
        standard_handles: Option<&StandardHandles>,
        job: Option<HANDLE>,
    ) -> Result<(Handle, Handle, u32), String> {
        let attributes = job.map(ProcessThreadAttributeList::for_job).transpose()?;
        let mut command_line_w = wide_null(&request.command_line);
        let application_w = wide_null(&request.application);
        let cwd_w = request.cwd.as_deref().map(wide_null);
        let mut startup: STARTUPINFOEXW = unsafe { std::mem::zeroed() };
        startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
        if let Some(handles) = standard_handles {
            startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
            startup.StartupInfo.hStdInput = handles.input;
            startup.StartupInfo.hStdOutput = handles.output;
            startup.StartupInfo.hStdError = handles.error;
        }
        startup.lpAttributeList = attributes
            .as_ref()
            .map(|attributes| attributes.pointer)
            .unwrap_or(null_mut());

        let creation_flags = CREATE_SUSPENDED
            | CREATE_NO_WINDOW
            | CREATE_UNICODE_ENVIRONMENT
            | if job.is_none() {
                CREATE_BREAKAWAY_FROM_JOB
            } else {
                EXTENDED_STARTUPINFO_PRESENT
            };

        let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };
        let created = unsafe {
            CreateProcessW(
                application_w.as_ptr(),
                command_line_w.as_mut_ptr(),
                null(),
                null(),
                i32::from(standard_handles.is_some()),
                creation_flags,
                null_mut(),
                cwd_w.as_ref().map(|v| v.as_ptr()).unwrap_or(null()),
                &startup.StartupInfo,
                &mut process_info,
            )
        };
        if created == 0 {
            let err = unsafe { GetLastError() };
            return Err(format!(
                "CreateProcessW failed for {} (win32={err})",
                request.application
            ));
        }

        Ok((
            Handle(process_info.hProcess),
            Handle(process_info.hThread),
            process_info.dwProcessId,
        ))
    }

    fn run_request(request: Request) -> Result<u32, String> {
        let request = launch_request(request);
        if request.runtime_occurrence_id.is_empty() || request.owner_process_instance_id.is_empty()
        {
            return Err("runtime owner occurrence identity is missing".into());
        }
        let helper_pid = unsafe { GetCurrentProcessId() };
        let helper_parent_pid = snapshot_processes()?
            .into_iter()
            .find(|process| process.pid == helper_pid)
            .map(|process| process.parent_pid)
            .ok_or_else(|| "Windows supervisor helper parent process is unavailable".to_string())?;
        if helper_parent_pid != request.owner_pid {
            return Err(format!(
                "Windows supervisor owner PID {} does not match helper parent {}",
                request.owner_pid, helper_parent_pid
            ));
        }
        let owner_handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, request.owner_pid) };
        if owner_handle.is_null() || owner_handle == INVALID_HANDLE_VALUE {
            let error = unsafe { GetLastError() };
            return Err(format!(
                "OpenProcess(runtime owner {}) failed (win32={error})",
                request.owner_pid
            ));
        }
        let owner = Handle(owner_handle);
        let standard_handles = inherited_standard_handles()?;
        let target = create_suspended_target(&request, Some(&standard_handles))?;

        if let Err(error) = publish_ready_marker(
            &request.ready_file,
            &request.request_id,
            &request.runtime_occurrence_id,
            target.pid,
        ) {
            return Err(settle_target_after_failure(error, &request, &target));
        }

        let resumed = unsafe { ResumeThread(target.thread.0) };
        if resumed == u32::MAX {
            return Err(settle_target_after_failure(
                "ResumeThread failed".into(),
                &request,
                &target,
            ));
        }

        let mut cancellation_applied = false;
        loop {
            let waited = unsafe { WaitForSingleObject(target.process.0, 20) };
            if waited == WAIT_OBJECT_0 {
                break;
            }
            if waited != WAIT_TIMEOUT {
                let error = unsafe { GetLastError() };
                return Err(settle_target_after_failure(
                    format!("WaitForSingleObject failed for target process (win32={error})"),
                    &request,
                    &target,
                ));
            }
            let owner_dead = unsafe { WaitForSingleObject(owner.0, 0) } == WAIT_OBJECT_0;
            if owner_dead || cancellation_requested(&request.cancel_file) {
                if let Some(job) = target.job.as_ref() {
                    terminate_job_once(job.0, &mut cancellation_applied)?;
                } else {
                    terminate_process_handle(target.process.0, target.pid)?;
                    cancellation_applied = true;
                }
            }
        }
        let mut code = 1u32;
        let read_exit_code = unsafe { GetExitCodeProcess(target.process.0, &mut code) };
        if read_exit_code == 0 {
            let error = unsafe { GetLastError() };
            return Err(settle_target_after_failure(
                format!("GetExitCodeProcess failed for target process (win32={error})"),
                &request,
                &target,
            ));
        }
        if let Some(job) = target.job.as_ref() {
            if let Err(error) = wait_for_job_active_process_zero(
                job.0,
                &request.cancel_file,
                Some(owner.0),
                &mut cancellation_applied,
            ) {
                return Err(settle_target_after_failure(error, &request, &target));
            }
        }
        publish_settlement_marker(&request, target.pid)?;
        drop(target);
        Ok(code)
    }

    fn publish_ready_marker(
        ready_file: &str,
        request_id: &str,
        runtime_occurrence_id: &str,
        target_pid: u32,
    ) -> Result<(), String> {
        let helper_pid = unsafe { GetCurrentProcessId() };
        let temporary_file = format!("{ready_file}.{helper_pid}.tmp");
        let marker = ReadyMarker {
            protocol: 1,
            request_id,
            helper_pid,
            target_pid,
            runtime_occurrence_id,
        };
        let mut file = fs::File::create(&temporary_file)
            .map_err(|error| format!("create ready marker failed: {error}"))?;
        if let Err(error) = serde_json::to_writer(&mut file, &marker) {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("serialize ready marker failed: {error}"));
        }
        if let Err(error) = file.sync_all() {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("flush ready marker failed: {error}"));
        }
        drop(file);
        if let Err(error) = fs::rename(&temporary_file, ready_file) {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("publish ready marker failed: {error}"));
        }
        Ok(())
    }

    fn publish_settlement_marker(request: &LaunchRequest, target_pid: u32) -> Result<(), String> {
        let helper_pid = unsafe { GetCurrentProcessId() };
        let temporary_file = format!("{}.{}.tmp", request.settled_file, helper_pid);
        let marker = SettlementMarker {
            protocol: 1,
            request_id: &request.request_id,
            helper_pid,
            target_pid,
            active_processes: 0,
            runtime_occurrence_id: &request.runtime_occurrence_id,
        };
        let mut file = fs::File::create(&temporary_file)
            .map_err(|error| format!("create settlement marker failed: {error}"))?;
        if let Err(error) = serde_json::to_writer(&mut file, &marker) {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("serialize settlement marker failed: {error}"));
        }
        if let Err(error) = file.sync_all() {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("flush settlement marker failed: {error}"));
        }
        drop(file);
        if let Err(error) = fs::rename(&temporary_file, &request.settled_file) {
            let _ = fs::remove_file(&temporary_file);
            return Err(format!("publish settlement marker failed: {error}"));
        }
        Ok(())
    }

    fn settle_target_after_failure(
        primary: String,
        request: &LaunchRequest,
        target: &SuspendedTarget,
    ) -> String {
        let cleanup = if let Some(job) = target.job.as_ref() {
            let mut cancellation_applied = false;
            terminate_job_once(job.0, &mut cancellation_applied)
                .and_then(|()| {
                    wait_for_job_active_process_zero(job.0, "", None, &mut cancellation_applied)
                })
                .and_then(|()| publish_settlement_marker(request, target.pid))
        } else {
            terminate_process_handle(target.process.0, target.pid)
                .and_then(|()| publish_settlement_marker(request, target.pid))
        };
        match cleanup {
            Ok(()) => primary,
            Err(cleanup) => format!("{primary}; managed physical settlement failed: {cleanup}"),
        }
    }

    fn terminate_process_handle(process: HANDLE, pid: u32) -> Result<(), String> {
        let initial_state = unsafe { WaitForSingleObject(process, 0) };
        if initial_state == WAIT_OBJECT_0 {
            return Ok(());
        }
        let terminated = unsafe { TerminateProcess(process, 1) };
        if terminated == 0 {
            let error = unsafe { GetLastError() };
            let next_state = unsafe { WaitForSingleObject(process, 0) };
            if next_state == WAIT_OBJECT_0 {
                return Ok(());
            }
            return Err(format!(
                "TerminateProcess failed for pid {pid} (win32={error})"
            ));
        }
        let waited = unsafe { WaitForSingleObject(process, 1000) };
        if waited != WAIT_OBJECT_0 {
            return Err(format!(
                "process {pid} did not exit after TerminateProcess (wait={waited})"
            ));
        }
        Ok(())
    }

    fn snapshot_processes() -> Result<Vec<ProcessInfo>, String> {
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot == INVALID_HANDLE_VALUE {
            let err = unsafe { GetLastError() };
            return Err(format!("CreateToolhelp32Snapshot failed (win32={err})"));
        }
        let snapshot = Handle(snapshot);
        let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let first = unsafe { Process32FirstW(snapshot.0, &mut entry) };
        if first == 0 {
            let err = unsafe { GetLastError() };
            return Err(format!("Process32FirstW failed (win32={err})"));
        }

        let mut processes = Vec::new();
        loop {
            processes.push(ProcessInfo {
                pid: entry.th32ProcessID,
                parent_pid: entry.th32ParentProcessID,
            });
            let next = unsafe { Process32NextW(snapshot.0, &mut entry) };
            if next == 0 {
                let error = unsafe { GetLastError() };
                if error == ERROR_NO_MORE_FILES {
                    break;
                }
                return Err(format!("Process32NextW failed (win32={error})"));
            }
        }
        Ok(processes)
    }

    fn descendant_pids(root_pid: u32, processes: &[ProcessInfo]) -> Vec<u32> {
        let mut result = Vec::new();
        let mut stack = vec![root_pid];
        while let Some(parent_pid) = stack.pop() {
            for process in processes
                .iter()
                .filter(|process| process.parent_pid == parent_pid)
            {
                if process.pid == root_pid || result.contains(&process.pid) {
                    continue;
                }
                result.push(process.pid);
                stack.push(process.pid);
            }
        }
        result
    }

    fn open_terminable_process(pid: u32) -> Result<Option<Handle>, String> {
        let handle = unsafe { OpenProcess(PROCESS_TERMINATE | PROCESS_SYNCHRONIZE, 0, pid) };
        if handle.is_null() {
            let err = unsafe { GetLastError() };
            if err == ERROR_INVALID_PARAMETER {
                return Ok(None);
            }
            return Err(format!("OpenProcess failed for pid {pid} (win32={err})"));
        }
        Ok(Some(Handle(handle)))
    }

    fn terminate_pid(pid: u32) -> Result<(), String> {
        let Some(process) = open_terminable_process(pid)? else {
            return Ok(());
        };

        terminate_process_handle(process.0, pid)
    }

    fn terminate_process_tree(pid: u32) -> Result<(), String> {
        let processes = snapshot_processes()?;
        let mut descendants = descendant_pids(pid, &processes);
        descendants.reverse();
        // Terminate the owner first so it cannot create more descendants while
        // cleanup walks the immutable snapshot. The remaining snapshotted
        // descendants are then terminated deepest-first.
        let mut targets = vec![pid];
        targets.extend(descendants);
        let failures = targets
            .into_iter()
            .filter_map(|target| terminate_pid(target).err())
            .collect::<Vec<_>>();
        if !failures.is_empty() {
            return Err(format!(
                "failed to terminate one or more process-tree members: {}",
                failures.join("; ")
            ));
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{
            process::Command,
            thread,
            time::{Duration, Instant},
        };

        #[test]
        fn dropping_job_terminates_target_before_resume() {
            let executable = env::current_exe().expect("resolve current test executable");
            let request = LaunchRequest {
                application: executable.to_string_lossy().into_owned(),
                command_line: quote_arg(&executable.to_string_lossy()),
                cwd: None,
                cancel_file: String::new(),
                ready_file: String::new(),
                settled_file: String::new(),
                request_id: "native-job-ownership-test".into(),
                owner_pid: unsafe { GetCurrentProcessId() },
                owner_process_instance_id: "native-test-owner".into(),
                runtime_occurrence_id: "native-test-occurrence".into(),
                detached: false,
            };
            let target = create_suspended_target(&request, None)
                .expect("create suspended target atomically assigned to job");
            let SuspendedTarget {
                job,
                process,
                thread,
                pid,
            } = target;
            drop(thread);
            drop(job.expect("managed target owns a cleanup job"));

            let waited = unsafe { WaitForSingleObject(process.0, 2_000) };
            if waited != WAIT_OBJECT_0 {
                let cleanup = terminate_process_handle(process.0, pid);
                panic!(
                    "suspended target did not exit when its job closed (wait={waited}, cleanup={cleanup:?})"
                );
            }
        }

        #[test]
        fn managed_job_settles_only_after_every_assigned_process_exits() {
            let job = create_job().expect("create managed test job");
            let command = env::var("COMSPEC").expect("resolve Windows command interpreter");
            let root_request = LaunchRequest {
                application: command.clone(),
                command_line: format!("{} /d /s /c exit 7", quote_arg(&command)),
                cwd: None,
                cancel_file: String::new(),
                ready_file: String::new(),
                settled_file: String::new(),
                request_id: "native-job-root-test".into(),
                owner_pid: unsafe { GetCurrentProcessId() },
                owner_process_instance_id: "native-test-owner".into(),
                runtime_occurrence_id: "native-test-occurrence".into(),
                detached: false,
            };
            let descendant_request = LaunchRequest {
                application: command.clone(),
                command_line: format!("{} /d /s /c ping 127.0.0.1 -n 2 >NUL", quote_arg(&command)),
                cwd: None,
                cancel_file: String::new(),
                ready_file: String::new(),
                settled_file: String::new(),
                request_id: "native-job-descendant-test".into(),
                owner_pid: unsafe { GetCurrentProcessId() },
                owner_process_instance_id: "native-test-owner".into(),
                runtime_occurrence_id: "native-test-occurrence".into(),
                detached: false,
            };
            let (root, root_thread, root_pid) =
                create_suspended_process(&root_request, None, Some(job.0))
                    .expect("create managed root");
            let (descendant, descendant_thread, descendant_pid) =
                create_suspended_process(&descendant_request, None, Some(job.0))
                    .expect("create managed descendant");
            assert_ne!(unsafe { ResumeThread(root_thread.0) }, u32::MAX);
            assert_ne!(unsafe { ResumeThread(descendant_thread.0) }, u32::MAX);
            assert_eq!(
                unsafe { WaitForSingleObject(root.0, 2_000) },
                WAIT_OBJECT_0,
                "managed root {root_pid} did not exit"
            );
            let active_after_root =
                job_active_process_count(job.0).expect("query managed Job membership");
            assert!(
                active_after_root >= 1,
                "managed descendant {descendant_pid} must retain the Job after root exit; active={active_after_root}"
            );
            let mut cancellation_applied = false;
            wait_for_job_active_process_zero(job.0, "", None, &mut cancellation_applied)
                .expect("wait for managed Job active-process-zero");
            assert_eq!(
                unsafe { WaitForSingleObject(descendant.0, 0) },
                WAIT_OBJECT_0
            );
        }

        #[test]
        fn terminate_tree_reclaims_owner_and_snapshotted_descendants() {
            let mut owner = Command::new("cmd.exe")
                .args(["/C", "ping 127.0.0.1 -n 60 >NUL"])
                .spawn()
                .expect("spawn process-tree owner");
            let owner_pid = owner.id();
            let deadline = Instant::now() + Duration::from_secs(3);
            let descendants = loop {
                let processes = snapshot_processes().expect("snapshot spawned process tree");
                let descendants = descendant_pids(owner_pid, &processes);
                if !descendants.is_empty() || Instant::now() >= deadline {
                    break descendants;
                }
                thread::sleep(Duration::from_millis(20));
            };
            assert!(
                !descendants.is_empty(),
                "cmd process-tree owner did not publish a descendant"
            );

            terminate_process_tree(owner_pid).expect("terminate owner and descendants");
            let owner_status = owner.wait().expect("wait for terminated owner");
            assert_eq!(
                owner_status.code(),
                Some(1),
                "terminated owner must expose the TerminateProcess exit code"
            );
            for descendant in descendants {
                let state =
                    open_terminable_process(descendant).expect("inspect terminated descendant");
                if let Some(process) = state {
                    assert_eq!(
                        unsafe { WaitForSingleObject(process.0, 0) },
                        WAIT_OBJECT_0,
                        "descendant {descendant} remains running"
                    );
                }
            }
        }
    }

    pub fn main() {
        let mut args = env::args().skip(1);
        match (args.next().as_deref(), args.next()) {
            (Some("--version"), None) => {
                println!("{}", env!("CARGO_PKG_VERSION"));
                std::process::exit(0);
            }
            (Some("--request"), Some(request_path)) => {
                let body = match fs::read_to_string(&request_path) {
                    Ok(body) => body,
                    Err(err) => {
                        eprintln!("read request failed: {err}");
                        std::process::exit(2);
                    }
                };
                let request: Request = match serde_json::from_str(&body) {
                    Ok(request) => request,
                    Err(err) => {
                        eprintln!("parse request failed: {err}");
                        std::process::exit(2);
                    }
                };
                match run_request(request) {
                    Ok(code) => std::process::exit(code as i32),
                    Err(err) => {
                        eprintln!("opencorvus process supervisor failed: {err}");
                        std::process::exit(125);
                    }
                }
            }
            (Some("--kill-tree"), Some(pid)) => {
                let pid = match pid.parse::<u32>() {
                    Ok(pid) if pid > 0 => pid,
                    _ => {
                        eprintln!("invalid process id for --kill-tree");
                        std::process::exit(2);
                    }
                };
                match terminate_process_tree(pid) {
                    Ok(()) => std::process::exit(0),
                    Err(err) => {
                        eprintln!("opencorvus process tree cleanup failed: {err}");
                        std::process::exit(125);
                    }
                }
            }
            _ => {
                eprintln!(
                    "usage: opencorvus-process-supervisor --version | --request <json> | --kill-tree <pid>"
                );
                std::process::exit(2);
            }
        }
    }
}

#[cfg(windows)]
fn main() {
    windows_helper::main();
}

#[cfg(not(windows))]
fn main() {
    eprintln!("opencorvus-process-supervisor is only supported on Windows");
    std::process::exit(125);
}
