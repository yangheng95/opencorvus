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
            serde_json::from_value::<RunnerConfig>(encoded).expect("actual Tauri config parsing"),
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
    let error = serde_json::to_value(value).expect_err("empty map entry's explicit error contract");
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
