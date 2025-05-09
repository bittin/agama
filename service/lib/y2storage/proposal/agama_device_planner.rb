# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "y2storage/planned"
require "y2storage/proposal/agama_md_name"

module Y2Storage
  module Proposal
    # Base class used by Agama planners.
    class AgamaDevicePlanner
      include AgamaMdName

      # @!attribute [r] devicegraph
      #   Devicegraph to be used as starting point.
      #   @return [Devicegraph]
      attr_reader :devicegraph

      # @!attribute [r] issues_list
      #   List of issues to register any found problem
      #   @return [Array<Agama::Issue>]
      attr_reader :issues_list

      # @!attribute [r] partitionables
      #   Map to track the planned devices that can contain partitions, indexed by alias
      # @return [Hash{String => Array<Planned::Device>}]
      attr_reader :partitionables

      # Constructor
      #
      # @param devicegraph [Devicegraph] see {#devicegraph}
      # @param issues_list [Array<Agama::Issue>] see {#issues_list}
      # @param partitionables [Array<Agama::Issue>] see {#partitionables}
      def initialize(devicegraph, issues_list, partitionables)
        @devicegraph = devicegraph
        @issues_list = issues_list
        @partitionables = partitionables
      end

      # Planned devices according to the given config.
      #
      # @return [Array<Planned::Device>]
      def planned_devices
        raise NotImplementedError
      end

    private

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      def configure_reuse(planned, config)
        device = config.found_device
        return unless device

        planned.assign_reuse(device)
        planned.reformat = reformat?(device, config)
        planned.resize = grow?(device, config) if planned.respond_to?(:resize=)
      end

      # Whether to reformat the device.
      #
      # @param device [Y2Storage::BlkDevice]
      # @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @return [Boolean]
      def reformat?(device, config)
        return true if device.filesystem.nil?

        # TODO: reformat if the encryption has to be created.
        !config.filesystem&.reuse?
      end

      # Whether the device is a candidate to be resized (grown)
      #
      # @param device [Y2Storage::BlkDevice]
      # @param config [Agama::Storage::Configs::Partition]
      # @return [Boolean]
      def grow?(device, config)
        return false unless config.size

        config.size.max.unlimited? || config.size.max > device.size
      end

      # @param planned [Planned::Disk, Planned::Partition, Planned::LvmLv]
      # @param config [#encryption, #filesystem]
      def configure_block_device(planned, config)
        configure_encryption(planned, config.encryption) if config.encryption
        configure_filesystem(planned, config.filesystem) if config.filesystem
      end

      # @param planned [Planned::Disk, Planned::Partition, Planned::LvmLv]
      # @param config [Agama::Storage::Configs::Filesystem]
      def configure_filesystem(planned, config)
        planned.mount_point = config.path
        planned.mount_by = config.mount_by
        planned.fstab_options = config.mount_options
        planned.mkfs_options = config.mkfs_options.join(",")
        planned.label = config.label
        configure_filesystem_type(planned, config.type) if config.type
      end

      # @param planned [Planned::Disk, Planned::Partition, Planned::LvmLv]
      # @param config [Agama::Storage::Configs::FilesystemType]
      def configure_filesystem_type(planned, config)
        planned.filesystem_type = config.fs_type
        configure_btrfs(planned, config.btrfs) if config.btrfs
      end

      # @param planned [Planned::Disk, Planned::Partition, Planned::LvmLv]
      # @param config [Agama::Storage::Configs::Btrfs]
      def configure_btrfs(planned, config)
        # TODO: we need to discuss what to do with transactional systems and the read_only
        # property. We are not sure whether those things should be configurable by the user.
        # planned.read_only = config.read_only?
        planned.snapshots = config.snapshots?
        planned.default_subvolume = config.default_subvolume
        planned.subvolumes = config.subvolumes
      end

      # @param planned [Planned::Disk, Planned::Partition, Planned::LvmLv]
      # @param config [Agama::Storage::Configs::Encryption]
      def configure_encryption(planned, config)
        planned.encryption_password = config.password
        planned.encryption_method = config.method
        planned.encryption_pbkdf = config.pbkd_function
        planned.encryption_label = config.label
        planned.encryption_cipher = config.cipher
        planned.encryption_key_size = config.key_size
      end

      # @param planned [Planned::Partition, Planned::LvmLv]
      # @param config [Agama::Storage::Configs::Size]
      def configure_size(planned, config)
        planned.min_size = config.min
        planned.max_size = config.max
        planned.weight = 100
      end

      # @param planned [Planned::Disk]
      # @param device_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      def configure_partitions(planned, device_config, config)
        planned.ptable_type = device_config.ptable_type if planned.respond_to?(:ptable_type=)

        partition_configs = device_config.partitions
          .reject(&:delete?)
          .reject(&:delete_if_needed?)
          .reject { |c| c.search&.skip_device? }

        planned.partitions = partition_configs.map do |partition_config|
          planned_partition(partition_config, device_config, config)
        end
      end

      # @param partition_config [Agama::Storage::Configs::Partition]
      # @param device_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      #
      # @return [Planned::Partition]
      def planned_partition(partition_config, device_config, config)
        Planned::Partition.new(nil, nil).tap do |planned|
          planned.disk = device_config.found_device&.name
          planned.partition_id = partition_config.id
          configure_reuse(planned, partition_config)
          configure_block_device(planned, partition_config)
          configure_size(planned, partition_config.size)
          configure_pv(planned, partition_config, config)
          configure_md_member(planned, partition_config, config)
        end
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param device_config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @param config [Agama::Storage::Config]
      def configure_pv(planned, device_config, config)
        return unless planned.respond_to?(:lvm_volume_group_name) && device_config.alias

        vg = config.volume_groups.find { |v| v.physical_volumes.include?(device_config.alias) }
        return unless vg

        planned.lvm_volume_group_name = vg.name
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param device_config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @param config [Agama::Storage::Config]
      def configure_md_member(planned, device_config, config)
        return unless planned.respond_to?(:raid_name) && device_config.alias

        md = config.md_raids.find { |r| r.devices.include?(device_config.alias) }
        return unless md

        planned.raid_name = member_md_name(md, device_config, config)
      end

      # Stores the given device at the map of partitionables
      #
      # @param device [Planned::Device]
      # @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Md]
      def register_partitionable(device, config)
        return unless config.alias

        partitionables[config.alias] ||= []
        partitionables[config.alias] << device
      end
    end
  end
end
