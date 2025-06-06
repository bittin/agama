# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/configs/with_filesystem"
require "agama/storage/configs/with_partitions"

module Agama
  module Storage
    module Configs
      # Configuration representing a MD RAID.
      class MdRaid
        include WithFilesystem
        include WithPartitions
        include WithAlias
        include WithSearch

        # MD RAID base name.
        #
        # @return [String, nil] e.g., "system".
        attr_accessor :name

        # MD RAId level.
        #
        # @return [Y2Storage::MdLevel, nil]
        attr_accessor :level

        # MD RAId parity algorithm.
        #
        # @return [Y2Storage::MdParity, nil]
        attr_accessor :parity

        # @return [Y2Storage::DiskSize, nil]
        attr_accessor :chunk_size

        # Aliases of the devices used by the MD RAID.
        #
        # @return [Array<String>]
        attr_accessor :devices

        # @return [Encryption, nil]
        attr_accessor :encryption

        def initialize
          initialize_partitions
          @devices = []
        end

        # Minimum number of member devices required by the MD RAID.
        #
        # FIXME: The information about the minimum number of devices is provided by the method
        #   Y2Storage::Md#minimal_number_of_devices, which requires to create a Md instance.
        #   This information should be available at class level.
        #
        # @note: Only raid0, raid1, raid5, raid6 and raid10 are meaningful for a MD RAID config.
        #
        # @return [Integer]
        def min_devices
          return 0 unless level

          case level.to_sym
          when :raid0, :raid1, :raid10
            2
          when :raid5
            3
          when :raid6
            4
          else
            0
          end
        end
      end
    end
  end
end
