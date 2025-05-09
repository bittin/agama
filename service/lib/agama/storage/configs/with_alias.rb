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

require "securerandom"

module Agama
  module Storage
    module Configs
      # Mixin for configs with alias.
      module WithAlias
        # @return [String, nil]
        attr_accessor :alias

        # Whether the config has the given alias.
        #
        # @return [Boolean]
        def alias?(value)
          self.alias == value
        end

        # Ensures the config has a value for alias.
        #
        # @return [String]
        def ensure_alias
          self.alias ||= SecureRandom.alphanumeric(10)
        end
      end
    end
  end
end
