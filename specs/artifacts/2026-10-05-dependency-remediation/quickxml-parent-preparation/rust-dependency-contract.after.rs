#[cfg(not(event_listener_contract))]
mod production {
    use serde::Serialize;
    use serde_with::{serde_as, KeyValueMap};
    use std::collections::BTreeMap;
    use tauri_utils::config::RunnerConfig;

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

    macro_rules! qualify_phf {
        ($generator:ident, $shared:ident) => {{
            let entries = [("alpha", 11), ("beta", 22), ("gamma", 33), ("delta", 44)];
            let keys: Vec<_> = entries.iter().map(|(key, _)| *key).collect();
            let generated = $generator::generate_hash(&keys);
            let actual: Vec<_> = keys
                .iter()
                .map(|key| {
                    let hashes = $shared::hash(key, &generated.key);
                    let slot =
                        $shared::get_index(&hashes, &generated.disps, generated.map.len()) as usize;
                    entries[generated.map[slot]]
                })
                .collect();
            assert_eq!(actual, entries);
            let repeated = $generator::generate_hash(&keys);
            assert_eq!(
                (repeated.key, repeated.disps, repeated.map),
                (generated.key, generated.disps, generated.map)
            );
        }};
    }

    #[test]
    fn actual_phf_010_generator_returns_exact_deterministic_lookups() {
        qualify_phf!(phf_generator_010, phf_shared_010);
    }

    #[test]
    fn actual_phf_011_generator_returns_exact_deterministic_lookups() {
        qualify_phf!(phf_generator_011, phf_shared_011);
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
            .with_protocol_versions(&[&rustls::version::TLS13])
            .unwrap()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let server = rustls::ServerConfig::builder_with_provider(provider)
            .with_protocol_versions(&[&rustls::version::TLS13])
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

    #[test]
    fn actual_rustls_authenticated_tls13_delivers_both_protected_payloads() {
        use std::io::{Read, Write};
        let (mut client, mut server) = tls_pair();
        for _ in 0..16 {
            transfer_tls(&mut client, &mut server);
            transfer_tls(&mut server, &mut client);
            if !client.is_handshaking() && !server.is_handshaking() {
                break;
            }
        }
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
