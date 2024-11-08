use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct StorageApiDocBuilder;

impl ApiDocBuilder for StorageApiDocBuilder {
    fn title(&self) -> String {
        "Storage HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::storage::web::__path_actions>()
            .path_from::<crate::storage::web::__path_devices_dirty>()
            .path_from::<crate::storage::web::__path_get_proposal_settings>()
            .path_from::<crate::storage::web::__path_probe>()
            .path_from::<crate::storage::web::__path_product_params>()
            .path_from::<crate::storage::web::__path_set_proposal_settings>()
            .path_from::<crate::storage::web::__path_staging_devices>()
            .path_from::<crate::storage::web::__path_system_devices>()
            .path_from::<crate::storage::web::__path_usable_devices>()
            .path_from::<crate::storage::web::__path_volume_for>()
            .path_from::<crate::storage::web::iscsi::__path_delete_node>()
            .path_from::<crate::storage::web::iscsi::__path_discover>()
            .path_from::<crate::storage::web::iscsi::__path_initiator>()
            .path_from::<crate::storage::web::iscsi::__path_login_node>()
            .path_from::<crate::storage::web::iscsi::__path_logout_node>()
            .path_from::<crate::storage::web::iscsi::__path_nodes>()
            .path_from::<crate::storage::web::iscsi::__path_update_initiator>()
            .path_from::<crate::storage::web::iscsi::__path_update_node>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<crate::storage::web::ProductParams>()
            .schema_from::<crate::storage::web::iscsi::DiscoverParams>()
            .schema_from::<crate::storage::web::iscsi::InitiatorParams>()
            .schema_from::<crate::storage::web::iscsi::LoginParams>()
            .schema_from::<crate::storage::web::iscsi::NodeParams>()
            .schema_from::<agama_lib::storage::model::Action>()
            .schema_from::<agama_lib::storage::model::BlockDevice>()
            .schema_from::<agama_lib::storage::model::Component>()
            .schema_from::<agama_lib::storage::model::Device>()
            .schema_from::<agama_lib::storage::model::DeviceInfo>()
            .schema_from::<agama_lib::storage::model::DeviceSid>()
            .schema_from::<agama_lib::storage::model::Drive>()
            .schema_from::<agama_lib::storage::model::DriveInfo>()
            .schema_from::<agama_lib::storage::model::DeviceSize>()
            .schema_from::<agama_lib::storage::model::Filesystem>()
            .schema_from::<agama_lib::storage::model::LvmLv>()
            .schema_from::<agama_lib::storage::model::LvmVg>()
            .schema_from::<agama_lib::storage::model::Md>()
            .schema_from::<agama_lib::storage::model::Multipath>()
            .schema_from::<agama_lib::storage::model::Partition>()
            .schema_from::<agama_lib::storage::model::PartitionTable>()
            .schema_from::<agama_lib::storage::model::ProposalSettings>()
            .schema_from::<agama_lib::storage::model::ProposalSettingsPatch>()
            .schema_from::<agama_lib::storage::model::ProposalTarget>()
            .schema_from::<agama_lib::storage::model::Raid>()
            .schema_from::<agama_lib::storage::model::ShrinkingInfo>()
            .schema_from::<agama_lib::storage::model::SpaceAction>()
            .schema_from::<agama_lib::storage::model::SpaceActionSettings>()
            .schema_from::<agama_lib::storage::model::UnusedSlot>()
            .schema_from::<agama_lib::storage::model::Volume>()
            .schema_from::<agama_lib::storage::model::VolumeOutline>()
            .schema_from::<agama_lib::storage::model::VolumeTarget>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSIAuth>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSIInitiator>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSINode>()
            .schema_from::<agama_lib::storage::client::iscsi::LoginResult>()
            .build()
    }
}
