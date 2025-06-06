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

require "agama/storage/proposal_strategies/base"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings_conversions/from_y2storage"

module Agama
  module Storage
    module ProposalStrategies
      # Main strategy for the Agama proposal.
      class Guided < Base
        include Yast::I18n

        # @param product_config [Config] Product config
        # @param storage_system [Storage::System]
        # @param input_settings [ProposalSettings]
        # @param logger [Logger]
        def initialize(product_config, storage_system, input_settings, logger)
          textdomain "agama"

          super(product_config, storage_system, logger)
          @input_settings = input_settings
        end

        # Settings used for calculating the proposal.
        #
        # @note Some values are recoverd from Y2Storage, see
        #   {ProposalSettingsConversions::FromY2Storage}
        #
        # @return [ProposalSettings]
        attr_reader :settings

        # @see Base#calculate
        def calculate
          select_target_device(input_settings) if missing_target_device?(input_settings)
          proposal = guided_proposal(input_settings)
          proposal.propose
        ensure
          storage_manager.proposal = proposal
          @settings = ProposalSettingsConversions::FromY2Storage
            .new(proposal.settings, input_settings)
            .convert
        end

        # @see Base#issues
        def issues
          # Returning [] in case of a missing proposal is a workaround (the scenario should
          # not happen). But this class is not expected to live long.
          return [] unless storage_manager.proposal
          return [] unless storage_manager.proposal.failed?

          [target_device_issue, missing_devices_issue].compact
        end

      private

        # Initial set of proposal settings
        # @return [ProposalSettings]
        attr_reader :input_settings

        # Available devices for installation.
        #
        # @return [Array<Y2Storage::Device>]
        def available_devices
          storage_system.analyzer&.candidate_disks || []
        end

        # Selects the first available device as target device for installation.
        #
        # @param settings [ProposalSettings]
        def select_target_device(settings)
          device = available_devices.first&.name
          return unless device

          case settings.device
          when DeviceSettings::Disk
            settings.device.name = device
          when DeviceSettings::NewLvmVg
            settings.device.candidate_pv_devices = [device]
          when DeviceSettings::ReusedLvmVg
            # TODO: select an existing VG?
          end
        end

        # Whether the given settings has no target device for the installation.
        #
        # @param settings [ProposalSettings]
        # @return [Boolean]
        def missing_target_device?(settings)
          case settings.device
          when DeviceSettings::Disk, DeviceSettings::ReusedLvmVg
            settings.device.name.nil?
          when DeviceSettings::NewLvmVg
            settings.device.candidate_pv_devices.empty?
          end
        end

        # Instance of the Y2Storage proposal to be used to run the calculation.
        #
        # @param settings [Y2Storage::ProposalSettings]
        # @return [Y2Storage::GuidedProposal]
        def guided_proposal(settings)
          Y2Storage::MinGuidedProposal.new(
            settings:      settings.to_y2storage(config: product_config),
            devicegraph:   storage_system.devicegraph,
            disk_analyzer: storage_system.analyzer
          )
        end

        # Returns an issue if there is no target device.
        #
        # @return [Issue, nil]
        def target_device_issue
          return unless missing_target_device?(settings)

          Issue.new(_("No device selected for installation"),
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR)
        end

        # Returns an issue if any of the devices required for the proposal is not found
        #
        # @return [Issue, nil]
        def missing_devices_issue
          available = available_devices.map(&:name)
          missing = settings.installation_devices.reject { |d| available.include?(d) }

          return if missing.none?

          Issue.new(
            format(
              n_(
                "The following selected device is not found in the system: %{devices}",
                "The following selected devices are not found in the system: %{devices}",
                missing.size
              ),
              devices: missing.join(", ")
            ),
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR
          )
        end
      end
    end
  end
end
