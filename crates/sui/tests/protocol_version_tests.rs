// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use mysten_metrics::RegistryService;
use prometheus::Registry;
use sui_protocol_config::{ProtocolConfig, ProtocolVersion, SupportedProtocolVersions};
use test_utils::authority::start_node;

#[tokio::test]
#[should_panic]
async fn test_validator_panics_on_unsupported_protocol_version() {
    let dir = tempfile::TempDir::new().unwrap();
    let network_config = sui_config::builder::ConfigBuilder::new(&dir)
        .with_protocol_version(ProtocolVersion::new(2))
        .with_supported_protocol_versions(SupportedProtocolVersions::new_for_testing(1, 1))
        .build();

    let registry_service = RegistryService::new(Registry::new());
    let _sui_node = start_node(&network_config.validator_configs[0], registry_service).await;
}

#[test]
fn test_protocol_overrides() {
    telemetry_subscribers::init_for_testing();

    let _guard = ProtocolConfig::apply_overrides_for_testing(|_, mut config| {
        config.set_max_function_definitions_for_testing(42);
        config
    });

    assert_eq!(
        ProtocolConfig::get_for_max_version().max_function_definitions(),
        42
    );
}

// Same as the previous test, to ensure we have test isolation with all the caching that
// happens in get_for_min_version/get_for_max_version.
#[test]
fn test_protocol_overrides_2() {
    telemetry_subscribers::init_for_testing();

    let _guard = ProtocolConfig::apply_overrides_for_testing(|_, mut config| {
        config.set_max_function_definitions_for_testing(43);
        config
    });

    assert_eq!(
        ProtocolConfig::get_for_max_version().max_function_definitions(),
        43
    );
}

#[cfg(msim)]
mod sim_only_tests {

    use super::*;
    use move_binary_format::CompiledModule;
    use sui_types::{object::{Object, OBJECT_START_VERSION}, digests::TransactionDigest};
    use std::path::PathBuf;
    use std::sync::Arc;
    use sui_core::authority::sui_framework_injection;
    use sui_framework_build::compiled_package::BuildConfig;
    use sui_macros::*;
    use sui_protocol_config::{ProtocolVersion, SupportedProtocolVersions};
    use test_utils::network::{TestCluster, TestClusterBuilder};
    use tokio::time::{timeout, Duration};
    use tracing::info;

    #[sim_test]
    async fn test_protocol_version_upgrade() {
        ProtocolConfig::poison_get_for_min_version();

        let test_cluster = TestClusterBuilder::new()
            .with_epoch_duration_ms(10000)
            .with_supported_protocol_versions(SupportedProtocolVersions::new_for_testing(1, 2))
            .build()
            .await
            .unwrap();

        monitor_version_change(&test_cluster, 2 /* expected proto version */).await;
    }

    #[sim_test]
    async fn test_protocol_version_upgrade_one_laggard() {
        let _guard = ProtocolConfig::apply_overrides_for_testing(|_, mut config| {
            config.set_buffer_stake_for_protocol_upgrade_bps_for_testing(0);
            config
        });

        ProtocolConfig::poison_get_for_min_version();

        let test_cluster = TestClusterBuilder::new()
            .with_epoch_duration_ms(10000)
            .with_supported_protocol_version_callback(Arc::new(|idx, name| {
                if name.is_some() && idx == 0 {
                    // first validator only does not support version 2.
                    SupportedProtocolVersions::new_for_testing(1, 1)
                } else {
                    SupportedProtocolVersions::new_for_testing(1, 2)
                }
            }))
            .build()
            .await
            .unwrap();

        monitor_version_change(&test_cluster, 2 /* expected proto version */).await;

        // verify that the node that didn't support the new version shut itself down.
        for v in test_cluster.swarm.validators() {
            if !v
                .config
                .supported_protocol_versions
                .unwrap()
                .is_version_supported(ProtocolVersion::new(2))
            {
                assert!(!v.is_running(), "{:?}", v.name().concise());
            } else {
                assert!(v.is_running(), "{:?}", v.name().concise());
            }
        }
    }

    #[sim_test]
    async fn test_protocol_version_upgrade_no_quorum() {
        ProtocolConfig::poison_get_for_min_version();

        let test_cluster = TestClusterBuilder::new()
            .with_epoch_duration_ms(10000)
            .with_supported_protocol_version_callback(Arc::new(|idx, name| {
                if name.is_some() && idx <= 1 {
                    // two validators don't support version 2, so we never advance to 2.
                    SupportedProtocolVersions::new_for_testing(1, 1)
                } else {
                    SupportedProtocolVersions::new_for_testing(1, 2)
                }
            }))
            .build()
            .await
            .unwrap();

        monitor_version_change(&test_cluster, 1 /* expected proto version */).await;
    }

    #[sim_test]
    async fn test_framework_compatible_upgrade() {
        // Make a number of compatible changes, and expect the upgrade to go through:
        // - Add a new module, struct, and function
        // - Add a new ability to an existing struct
        // - Remove an ability from an existing type constraint
        // - Change the implementation of an existing function
        // - Change the signature and implementation of a private function

        ProtocolConfig::poison_get_for_min_version();

        sui_framework_injection::set_override(sui_framework("compatible"));
        let test_cluster = TestClusterBuilder::new()
            .with_epoch_duration_ms(10000)
            .with_objects([sui_framework_object("base")])
            .with_supported_protocol_versions(SupportedProtocolVersions::new_for_testing(1, 2))
            .build()
            .await
            .unwrap();

        monitor_version_change(&test_cluster, 2 /* expected proto version */).await;
    }

    async fn monitor_version_change(test_cluster: &TestCluster, final_version: u64) {
        let mut epoch_rx = test_cluster
            .fullnode_handle
            .sui_node
            .subscribe_to_epoch_change();

        timeout(Duration::from_secs(60), async move {
            while let Ok(committee) = epoch_rx.recv().await {
                info!(
                    "received epoch {} {:?}",
                    committee.epoch, committee.protocol_version
                );
                match committee.epoch {
                    0 => assert_eq!(committee.protocol_version, ProtocolVersion::new(1)),
                    1 => assert_eq!(
                        committee.protocol_version,
                        ProtocolVersion::new(final_version)
                    ),
                    2 => break,
                    _ => unreachable!(),
                }
            }
        })
        .await
        .expect("Timed out waiting for cluster to target epoch");
    }

    /// Get compiled modules for Sui Framework, built from fixture `fixture` in the
    /// `framework_upgrades` directory.
    fn sui_framework(fixture: &str) -> Vec<CompiledModule> {
        let mut package = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        package.extend(["tests", "framework_upgrades", fixture]);

        let pkg = BuildConfig {
            run_bytecode_verifier: true,
            print_diags_to_stderr: false,
            ..Default::default()
        }
        .build(package)
        .unwrap();

        pkg.get_framework_modules().cloned().collect()
    }

    /// Like `sui_framework`, but package the modules in an `Object`.
    fn sui_framework_object(fixture: &str) -> Object {
        Object::new_package(
            sui_framework(fixture),
            OBJECT_START_VERSION,
            TransactionDigest::genesis(),
            u64::MAX,
        ).unwrap()
    }
}
