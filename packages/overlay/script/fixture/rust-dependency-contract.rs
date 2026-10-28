#[cfg(not(event_listener_contract))]
mod production {
    use serde::Serialize;
    use serde_with::{serde_as, KeyValueMap};
    use std::collections::BTreeMap;
    use tauri_utils::config::RunnerConfig;

    #[test]
    fn actual_fs_safe_paths_preserve_relative_colons_and_unicode() {
        use std::{path::PathBuf, str::FromStr};
        for path in ["notes:2024.txt", "报告/交接说明.md", "C:\\owned\\report.md"] {
            let parsed = tauri_plugin_fs::SafeFilePath::from_str(path)
                .expect("actual fs safe path parsing");
            assert_eq!(parsed.into_path().expect("actual path value"), PathBuf::from(path));
        }
    }

    #[test]
    fn actual_fs_file_url_decodes_to_the_exact_windows_path() {
        let parsed: tauri_plugin_fs::SafeFilePath = serde_json::from_str(
            "\"file:///C:/owned/%E6%8A%A5%E5%91%8A.md\"",
        ).expect("actual fs input deserialization");
        assert_eq!(
            parsed.into_path().expect("actual file URL decoding"),
            std::path::PathBuf::from("C:\\owned\\报告.md"),
        );
    }

    #[test]
    fn actual_fs_paths_return_typed_traversal_and_url_errors() {
        use std::str::FromStr;
        let traversal = tauri_plugin_fs::SafeFilePath::from_str("../report.md")
            .expect_err("actual parent traversal error");
        assert!(matches!(traversal, tauri_plugin_fs::Error::UnsafePathBuf(_)));
        let url = tauri_plugin_fs::SafeFilePath::from_str("https://example.com/report.md")
            .expect("actual URL parsing").into_path().expect_err("actual URL path error");
        assert!(matches!(url, tauri_plugin_fs::Error::InvalidPathUrl));
        assert_eq!(serde_json::to_value(&url).expect("actual error response"), "URL is not a valid path");
    }

    #[test]
    fn actual_tauri_runner_config_serializes_and_round_trips_exactly() {
        let cases = [
            (
                RunnerConfig::String("cargo".into()),
                serde_json::json!("cargo"),
            ),
            (
                RunnerConfig::Object {
                    cmd: "cargo".into(),
                    cwd: None,
                    args: None,
                },
                serde_json::json!({ "cmd": "cargo" }),
            ),
            (
                RunnerConfig::Object {
                    cmd: "cargo".into(),
                    cwd: Some("owned-project".into()),
                    args: Some(vec!["build".into(), "--locked".into()]),
                },
                serde_json::json!({ "cmd": "cargo", "cwd": "owned-project", "args": ["build", "--locked"] }),
            ),
        ];
        for (value, expected) in cases {
            let encoded = serde_json::to_value(&value).expect("actual Tauri config serialization");
            assert_eq!(encoded, expected);
            assert_eq!(
                serde_json::from_value::<RunnerConfig>(encoded)
                    .expect("actual Tauri config parsing"),
                value
            );
        }
    }

    #[serde_as]
    #[derive(Serialize)]
    struct SequenceEntries {
        #[serde_as(as = "KeyValueMap<_>")]
        entries: Vec<Vec<String>>,
    }

    #[serde_as]
    #[derive(Serialize)]
    struct MapEntries {
        #[serde_as(as = "KeyValueMap<_>")]
        entries: Vec<BTreeMap<String, String>>,
    }

    // These three cases exercise the repaired dependency API. The application's
    // current Tauri configuration consumer above does not itself use KeyValueMap.
    #[test]
    fn key_value_map_returns_the_exact_sequence_mapping() {
        let value = SequenceEntries {
            entries: vec![vec!["alpha".into(), "one".into(), "two".into()]],
        };
        assert_eq!(
            serde_json::to_value(value).expect("populated sequence entry"),
            serde_json::json!({ "entries": { "alpha": ["one", "two"] } })
        );
    }

    #[test]
    fn key_value_map_empty_sequence_returns_the_serialization_error() {
        let value = SequenceEntries {
            entries: vec![vec![]],
        };
        let error = serde_json::to_value(value).expect_err("empty entry's explicit error contract");
        assert_eq!(error.to_string(), "missing value for `$key$` field");
    }

    #[test]
    fn key_value_map_empty_map_returns_the_serialization_error() {
        let value = MapEntries {
            entries: vec![BTreeMap::new()],
        };
        let error =
            serde_json::to_value(value).expect_err("empty map entry's explicit error contract");
        assert_eq!(error.to_string(), "missing value for `$key$` field");
    }

    #[test]
    fn actual_phf_013_generator_returns_exact_deterministic_lookups() {
        let entries = [("alpha", 11), ("beta", 22), ("gamma", 33), ("delta", 44)];
        let keys: Vec<_> = entries.iter().map(|(key, _)| *key).collect();
        let generated = phf_generator_013::generate_hash(&keys);
        let actual: Vec<_> = keys
            .iter()
            .map(|key| {
                let hashes = phf_shared_013::hash(key, &generated.key);
                let slot =
                    phf_shared_013::get_index(&hashes, &generated.disps, generated.map.len()) as usize;
                entries[generated.map[slot]]
            })
            .collect();
        assert_eq!(actual, entries);
        let repeated = phf_generator_013::generate_hash(&keys);
        assert_eq!(
            (repeated.key, repeated.disps, repeated.map),
            (generated.key, generated.disps, generated.map)
        );
    }

    #[derive(Debug)]
    struct InnerError(&'static str);

    #[test]
    fn actual_plist_xml_and_binary_return_complete_values() {
        use plist::{Dictionary, Value};
        let mut dictionary = Dictionary::new();
        dictionary.insert("text".into(), Value::String("中文😀 <>&\"'".into()));
        dictionary.insert("nested".into(), Value::Array(vec![Value::Boolean(true), Value::Integer((-17_i64).into())]));
        dictionary.insert("unsigned".into(), Value::Integer(42_u64.into()));
        dictionary.insert("bytes".into(), Value::Data(vec![0, 1, 127, 255]));
        dictionary.insert("date".into(), Value::Date(plist::Date::from_xml_format("2026-10-06T00:00:00Z").unwrap()));
        let expected = Value::Dictionary(dictionary);
        let mut xml = Vec::new();
        expected.to_writer_xml(&mut xml).unwrap();
        assert_eq!(Value::from_reader_xml(xml.as_slice()).unwrap(), expected);
        let mut binary = Vec::new();
        expected.to_writer_binary(&mut binary).unwrap();
        assert_eq!(Value::from_reader(std::io::Cursor::new(binary)).unwrap(), expected);
    }

    #[test]
    fn actual_plist_serde_returns_typed_values_and_explicit_type_error() {
        #[derive(Debug, serde::Serialize, serde::Deserialize, PartialEq)]
        struct Document { title: String, count: u64, active: bool }
        let expected = Document { title: "报告<&>😀".into(), count: 23, active: true };
        let mut xml = Vec::new();
        plist::to_writer_xml(&mut xml, &expected).unwrap();
        assert_eq!(plist::from_reader_xml::<_, Document>(xml.as_slice()).unwrap(), expected);
        let value = plist::to_value(&expected).unwrap();
        assert_eq!(plist::from_value::<Document>(&value).unwrap(), expected);
        let error = plist::from_value::<String>(&plist::Value::Boolean(true)).unwrap_err();
        assert_eq!(error.to_string(), "Serde(\"invalid type: boolean `true`, expected a string\")");
    }

    #[test]
    fn actual_tauri_association_plist_retains_dictionary_contract() {
        let association: tauri_utils::config::FileAssociation = serde_json::from_value(serde_json::json!({
            "ext": ["ocreport"], "name": "报告<&>", "role": "Editor", "rank": "Owner",
            "mimeType": "application/x-ocreport", "contentTypes": ["public.data"],
            "exportedType": { "identifier": "org.opencorvus.report", "conformsTo": ["public.data"] }
        })).unwrap();
        let value = tauri_utils::config::file_associations_plist(&[association]).unwrap();
        let document = &value.as_dictionary().unwrap()["CFBundleDocumentTypes"].as_array().unwrap()[0];
        let fields = document.as_dictionary().unwrap();
        assert_eq!(fields["CFBundleTypeName"].as_string(), Some("报告<&>"));
        assert_eq!(fields["CFBundleTypeRole"].as_string(), Some("Editor"));
        assert_eq!(fields["LSHandlerRank"].as_string(), Some("Owner"));
        assert_eq!(fields["CFBundleTypeExtensions"], plist::Value::Array(vec!["ocreport".into()]));
        let exported = &value.as_dictionary().unwrap()["UTExportedTypeDeclarations"].as_array().unwrap()[0];
        assert_eq!(exported.as_dictionary().unwrap()["UTTypeIdentifier"].as_string(), Some("org.opencorvus.report"));
        let mut xml = Vec::new();
        value.to_writer_xml(&mut xml).unwrap();
        assert_eq!(plist::Value::from_reader_xml(xml.as_slice()).unwrap(), value);
        let mut binary = Vec::new();
        value.to_writer_binary(&mut binary).unwrap();
        assert_eq!(plist::Value::from_reader(std::io::Cursor::new(binary)).unwrap(), value);
    }

    impl std::fmt::Display for InnerError {
        fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str(self.0)
        }
    }

    impl std::error::Error for InnerError {}

    #[derive(Debug)]
    struct ErrorContext(&'static str);

    impl std::fmt::Display for ErrorContext {
        fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str(self.0)
        }
    }

    #[test]
    fn actual_anyhow_context_and_inner_mutations_retain_the_error_chain() {
        let mut error = anyhow::Error::new(InnerError("initial inner"))
            .context(ErrorContext("initial context"));
        error.downcast_mut::<ErrorContext>().unwrap().0 = "authored context";
        error.downcast_mut::<InnerError>().unwrap().0 = "authored inner";
        assert_eq!(
            error.downcast_ref::<ErrorContext>().unwrap().0,
            "authored context"
        );
        assert_eq!(
            error.downcast_ref::<InnerError>().unwrap().0,
            "authored inner"
        );
        assert_eq!(format!("{error:#}"), "authored context: authored inner");
        assert_eq!(
            error.chain().map(ToString::to_string).collect::<Vec<_>>(),
            ["authored context", "authored inner"]
        );
        assert!(std::ptr::eq(
            error.root_cause().downcast_ref::<InnerError>().unwrap(),
            error.downcast_ref::<InnerError>().unwrap(),
        ));
    }

    // Public protocol cases follow Rustls v/0.23.45 rustls/tests/api.rs and its
    // rustls-test helpers (Apache-2.0 OR ISC OR MIT). The runner fetches their public
    // test PKI into an ignored directory; no test key is embedded in this source.
    fn tls_pair() -> (rustls::Connection, rustls::Connection) {
        tls_pair_for(&rustls::version::TLS13)
    }

    fn tls_pair_for(protocol: &'static rustls::SupportedProtocolVersion) -> (rustls::Connection, rustls::Connection) {
        use rustls_pki_types::pem::PemObject;
        use rustls_pki_types::{CertificateDer, PrivatePkcs8KeyDer, ServerName};
        use std::sync::Arc;

        let directory = std::path::PathBuf::from(
            std::env::var("OPENCORVUS_RUSTLS_TEST_PKI_DIR")
                .expect("owned public test PKI directory"),
        );
        let chain_pem = std::fs::read(directory.join("end.fullchain")).unwrap();
        let ca_pem = std::fs::read(directory.join("ca.cert")).unwrap();
        let key_pem = std::fs::read(directory.join("end.key")).unwrap();
        let chain = CertificateDer::pem_slice_iter(&chain_pem)
            .collect::<Result<Vec<_>, _>>()
            .expect("published public test chain");
        let key = PrivatePkcs8KeyDer::from_pem_slice(&key_pem).expect("published public test key");
        let mut roots = rustls::RootCertStore::empty();
        for certificate in CertificateDer::pem_slice_iter(&ca_pem) {
            roots.add(certificate.unwrap()).unwrap();
        }
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let client = rustls::ClientConfig::builder_with_provider(provider.clone())
            .with_protocol_versions(&[protocol])
            .unwrap()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let server = rustls::ServerConfig::builder_with_provider(provider)
            .with_protocol_versions(&[protocol])
            .unwrap()
            .with_no_client_auth()
            .with_single_cert(chain, key.into())
            .unwrap();
        (
            rustls::Connection::Client(
                rustls::ClientConnection::new(
                    Arc::new(client),
                    ServerName::try_from("localhost").unwrap(),
                )
                .unwrap(),
            ),
            rustls::Connection::Server(rustls::ServerConnection::new(Arc::new(server)).unwrap()),
        )
    }

    fn transfer_tls(from: &mut rustls::Connection, to: &mut rustls::Connection) {
        let mut wire = Vec::new();
        while from.wants_write() {
            from.write_tls(&mut wire).unwrap();
        }
        let mut input = std::io::Cursor::new(&wire);
        while input.position() < wire.len() as u64 {
            assert!(to.read_tls(&mut input).unwrap() > 0);
            to.process_new_packets().unwrap();
        }
    }

    fn complete_tls_handshake(client: &mut rustls::Connection, server: &mut rustls::Connection) {
        for _ in 0..16 {
            transfer_tls(client, server);
            transfer_tls(server, client);
            if !client.is_handshaking() && !server.is_handshaking() {
                return;
            }
        }
        panic!("TLS handshake exceeded its bounded exchange count");
    }

    #[test]
    fn actual_rustls_authenticated_tls13_delivers_both_protected_payloads() {
        use std::io::{Read, Write};
        let (mut client, mut server) = tls_pair();
        complete_tls_handshake(&mut client, &mut server);
        assert_eq!(
            client.protocol_version(),
            Some(rustls::ProtocolVersion::TLSv1_3)
        );
        assert_eq!(
            server.protocol_version(),
            Some(rustls::ProtocolVersion::TLSv1_3)
        );
        assert_eq!(client.peer_certificates().unwrap().len(), 3);
        client
            .writer()
            .write_all(b"client authenticated payload")
            .unwrap();
        transfer_tls(&mut client, &mut server);
        let mut request = [0; 28];
        server.reader().read_exact(&mut request).unwrap();
        assert_eq!(&request, b"client authenticated payload");
        server
            .writer()
            .write_all(b"server protected response")
            .unwrap();
        transfer_tls(&mut server, &mut client);
        let mut response = [0; 25];
        client.reader().read_exact(&mut response).unwrap();
        assert_eq!(&response, b"server protected response");
    }

    #[test]
    fn actual_rustls_authenticated_tls12_delivers_the_protected_payload() {
        use std::io::{Read, Write};
        let (mut client, mut server) = tls_pair_for(&rustls::version::TLS12);
        complete_tls_handshake(&mut client, &mut server);
        assert_eq!(client.protocol_version(), Some(rustls::ProtocolVersion::TLSv1_2));
        assert_eq!(server.protocol_version(), Some(rustls::ProtocolVersion::TLSv1_2));
        let expected = b"tls12 authenticated payload";
        client.writer().write_all(expected).unwrap();
        transfer_tls(&mut client, &mut server);
        let mut received = vec![0; expected.len()];
        server.reader().read_exact(&mut received).unwrap();
        assert_eq!(received, expected);
    }

    #[test]
    fn actual_tokio_runtime_transfers_both_tcp_payloads_and_joins() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        runtime.block_on(async {
            tokio::time::timeout(std::time::Duration::from_secs(5), async {
                let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
                let address = listener.local_addr().unwrap();
                let client = tokio::spawn(async move {
                    let mut socket = tokio::net::TcpStream::connect(address).await.unwrap();
                    socket.write_all(b"ping").await.unwrap();
                    let mut reply = [0; 4];
                    socket.read_exact(&mut reply).await.unwrap();
                    reply
                });
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = [0; 4];
                socket.read_exact(&mut request).await.unwrap();
                assert_eq!(&request, b"ping");
                socket.write_all(b"pong").await.unwrap();
                assert_eq!(&client.await.unwrap(), b"pong");
            }).await.expect("owned local TCP exchange completes within five seconds");
        });
    }

    #[test]
    fn actual_updater_parses_the_platform_feed_and_typed_target_error() {
        let release: tauri_plugin_updater::RemoteRelease = serde_json::from_value(serde_json::json!({
            "version": "0.1.34",
            "notes": "Native updater contract",
            "pub_date": "2026-10-28T00:00:00Z",
            "platforms": { "windows-x86_64": {
                "url": "https://example.invalid/opencorvus-update.zip",
                "signature": "public-contract-signature"
            } }
        })).unwrap();
        assert_eq!(release.version.to_string(), "0.1.34");
        assert_eq!(release.notes.as_deref(), Some("Native updater contract"));
        assert_eq!(release.download_url("windows-x86_64").unwrap().as_str(), "https://example.invalid/opencorvus-update.zip");
        assert_eq!(release.signature("windows-x86_64").unwrap(), "public-contract-signature");
        match release.download_url("linux-x86_64") {
            Err(tauri_plugin_updater::Error::TargetNotFound(target)) => assert_eq!(target, "linux-x86_64"),
            other => panic!("Expected the concrete target error, received {other:?}"),
        }
    }

    #[test]
    fn actual_zip_extracts_the_complete_regular_file() {
        use std::io::{Cursor, Write};
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        writer.start_file("payload/report.txt", zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored)).unwrap();
        writer.write_all(b"complete updater payload").unwrap();
        let bytes = writer.finish().unwrap();
        let destination = tempfile::tempdir().unwrap();
        zip::ZipArchive::new(bytes).unwrap().extract(destination.path()).unwrap();
        assert_eq!(std::fs::read(destination.path().join("payload/report.txt")).unwrap(), b"complete updater payload");
    }

    #[test]
    fn actual_zip_maps_an_escaping_symlink_to_the_archive_error() {
        use std::io::Cursor;
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("outside.txt"), b"owned test target").unwrap();
        let destination = root.path().join("extract");
        std::fs::create_dir(&destination).unwrap();
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        writer.add_symlink("link", "../outside.txt", zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored)).unwrap();
        let bytes = writer.finish().unwrap();
        match zip::ZipArchive::new(bytes).unwrap().extract(&destination) {
            Err(zip::result::ZipError::InvalidArchive(message)) => assert_eq!(message.as_ref(), "Path escapes the destination directory"),
            other => panic!("Expected the concrete escaping-link archive error, received {other:?}"),
        }
    }

    #[test]
    fn actual_urlpattern_captures_the_route_and_maps_duplicate_names_to_the_parser_error() {
        let pattern = <urlpattern::UrlPattern>::parse(urlpattern::UrlPatternInit {
            protocol: Some("https".into()), hostname: Some("example.invalid".into()), pathname: Some("/reports/:id".into()),
            ..Default::default()
        }, Default::default()).unwrap();
        let result = pattern.exec(urlpattern::UrlPatternMatchInput::Url("https://example.invalid/reports/42".parse().unwrap()))
            .unwrap().expect("the declared report route matches");
        assert_eq!(result.pathname.input, "/reports/42");
        assert_eq!(result.pathname.groups.get("id").unwrap().as_deref(), Some("42"));
        match <urlpattern::UrlPattern>::parse(urlpattern::UrlPatternInit {
            pathname: Some("/:id/:id".into()), ..Default::default()
        }, Default::default()) {
            Err(urlpattern::Error::Parser(error)) => assert_eq!(error.to_string(), "pattern contains duplicate name id"),
            other => panic!("Expected the duplicate-name parser error, received {other:?}"),
        }
    }

    // Public verification vector from minisign-verify 0.3.0's MIT-licensed tests.
    // This is a public verification key and signature; no signing key is present.
    #[test]
    fn actual_minisign_verifies_the_public_vector_and_maps_the_signature_error() {
        let key = minisign_verify::PublicKey::from_base64("RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3").unwrap();
        let signature = minisign_verify::Signature::decode(concat!(
            "untrusted comment: signature from minisign secret key\n",
            "RWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\n",
            "trusted comment: timestamp:1555779966\tfile:test\n",
            "QtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA=="
        )).unwrap();
        key.verify(b"test", &signature, true).expect("the published public verification vector authenticates");
        assert_eq!(signature.trusted_comment(), "timestamp:1555779966\tfile:test");
        match key.verify(b"Test", &signature, true) {
            Err(minisign_verify::Error::InvalidSignature) => (),
            other => panic!("Expected the concrete signature error, received {other:?}"),
        }
    }

    #[test]
    fn actual_rustls_key_boundary_returns_the_protocol_error_and_alert() {
        let (mut client, mut server) = tls_pair();
        transfer_tls(&mut client, &mut server);
        let mut flight = Vec::new();
        while server.wants_write() {
            server.write_tls(&mut flight).unwrap();
        }
        assert_eq!(&flight[..3], &[22, 3, 3]); // TLS handshake record, legacy TLS1.2 version.
        let first_length = u16::from_be_bytes([flight[3], flight[4]]) as usize;
        assert_eq!(flight[5], 2); // The real server's complete ServerHello.
        let mut crossed = flight[..5 + first_length].to_vec();
        // Complete EncryptedExtensions with an empty extensions vector, deliberately
        // framed in the ServerHello's plaintext record across its key transition.
        crossed.extend_from_slice(&[8, 0, 0, 2, 0, 0]);
        crossed[3..5].copy_from_slice(&u16::try_from(first_length + 6).unwrap().to_be_bytes());
        client.read_tls(&mut crossed.as_slice()).unwrap();
        assert_eq!(
            client.process_new_packets().unwrap_err(),
            rustls::Error::PeerMisbehaved(rustls::PeerMisbehaved::KeyEpochWithPendingFragment)
        );
        let mut alert = Vec::new();
        while client.wants_write() {
            client.write_tls(&mut alert).unwrap();
        }
        assert_eq!(alert, [21, 3, 3, 0, 2, 2, 10]); // Fatal UnexpectedMessage.
    }
}

// This crate is not in the Windows application's production artifact set.
// These tests run only against the separately recorded library-only build.
#[cfg(event_listener_contract)]
mod event_contracts {
    use event_listener::{listener, Event, IntoNotification, Listener};
    use std::{sync::mpsc, thread, time::Duration};

    #[test]
    fn actual_stack_listener_transfers_a_send_tag_and_joins() {
        let event = Event::<usize>::with_tag();
        let (registered, ready) = mpsc::sync_channel(1);
        let (completed, result) = mpsc::sync_channel(1);
        thread::scope(|scope| {
            let worker = scope.spawn(|| {
                listener!(event => listener);
                registered.send(()).unwrap();
                let tag = listener
                    .wait_timeout(Duration::from_secs(5))
                    .expect("tag delivery");
                completed.send(tag).unwrap();
                tag
            });
            ready.recv_timeout(Duration::from_secs(5)).unwrap();
            assert_eq!(event.notify(1.tag(41)), 1);
            assert_eq!(result.recv_timeout(Duration::from_secs(5)).unwrap(), 41);
            assert_eq!(worker.join().unwrap(), 41);
        });
    }

    #[test]
    fn actual_listener_cancellation_forwards_the_tag_then_reuses_in_order() {
        let event = Event::<usize>::with_tag();
        let cancelled = event.listen();
        let next = event.listen();
        assert_eq!(event.notify(1.tag(17)), 1);
        drop(cancelled);
        let forwarded = next
            .wait_timeout(Duration::from_secs(5))
            .expect("forwarded tag");
        let reused = event.listen();
        assert_eq!(event.notify(1.tag(29)), 1);
        let second = reused
            .wait_timeout(Duration::from_secs(5))
            .expect("reused listener tag");
        assert_eq!([forwarded, second], [17, 29]);
    }
}
