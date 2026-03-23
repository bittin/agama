# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../../test_helper"
require "agama/storage/configs/btrfs"
require "agama/storage/configs/filesystem"
require "agama/storage/configs/partition"
require "agama/storage/configs/search"
require "agama/storage/configs/size"
require "y2storage/filesystems/type"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without filesystem" do
  it "does not set #filesystem" do
    config = subject.convert
    expect(config.filesystem).to be_nil
  end
end

shared_examples "without ptableType" do
  it "does not set #ptable_type" do
    config = subject.convert
    expect(config.ptable_type).to be_nil
  end
end

shared_examples "without spacePolicy" do
  context "if the default space policy is 'keep'" do
    let(:space_policy) { "keep" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end

  context "if the default space policy is 'delete'" do
    let(:space_policy) { "delete" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(true)
    end
  end

  context "if the default space policy is 'resize'" do
    let(:space_policy) { "resize" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(false)
      expect(partition.size.default?).to eq(false)
      expect(partition.size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partition.size.max).to be_nil
    end
  end

  context "if the default space policy is 'custom'" do
    let(:space_policy) { "custom" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end
end

shared_examples "without size" do
  it "sets #size to default size" do
    config = subject.convert
    expect(config.size.default?).to eq(true)
    expect(config.size.min).to be_nil
    expect(config.size.max).to be_nil
  end
end

shared_examples "without delete" do
  it "sets #delete to false" do
    config = subject.convert
    expect(config.delete?).to eq(false)
  end
end

shared_examples "without deleteIfNeeded" do
  it "sets #delete_if_needed to false" do
    config = subject.convert
    expect(config.delete_if_needed?).to eq(false)
  end
end

shared_examples "with name" do
  let(:name) { "/dev/vda" }

  it "sets #search to the expected value" do
    config = subject.convert
    expect(config.search).to be_a(Agama::Storage::Configs::Search)
    expect(config.search.name).to eq("/dev/vda")
    expect(config.search.max).to be_nil
    expect(config.search.if_not_found).to eq(:error)
  end
end

shared_examples "with mountPath" do
  let(:mountPath) { "/test" }

  it "sets #filesystem to the expected value" do
    config = subject.convert
    filesystem = config.filesystem
    expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
    expect(filesystem.reuse?).to eq(false)
    expect(filesystem.type).to be_nil
    expect(filesystem.label).to be_nil
    expect(filesystem.path).to eq("/test")
    expect(filesystem.mount_by).to be_nil
    expect(filesystem.mkfs_options).to be_empty
    expect(filesystem.mount_options).to be_empty
  end
end

shared_examples "with filesystem" do
  let(:filesystem) do
    {
      reuse:   reuse,
      default: default,
      type:    type,
      label:   label
    }
  end

  let(:reuse) { false }
  let(:default) { false }
  let(:type) { nil }
  let(:label) { "test" }

  context "if the filesystem is default" do
    let(:default) { true }

    RSpec.shared_examples "#filesystem set to default btrfs" do
      it "sets #filesystem to the expected btrfs-related values" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(true)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end

    context "and the type is 'btrfs'" do
      let(:type) { "btrfs" }

      include_examples "#filesystem set to default btrfs"

      it "sets Btrfs snapshots to false" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(false)
      end
    end

    context "and the type is 'btrfsSnapshots'" do
      let(:type) { "btrfsSnapshots" }

      include_examples "#filesystem set to default btrfs"

      it "sets Btrfs snapshots to true" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
      end
    end

    context "and the type is 'btrfsImmutable'" do
      let(:type) { "btrfsSnapshots" }

      include_examples "#filesystem set to default btrfs"

      it "sets Btrfs snapshots to true" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
      end
    end

    context "and the type is not 'btrfs'" do
      let(:type) { "xfs" }

      it "sets #filesystem to the expected value" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(true)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
        expect(filesystem.type.btrfs).to be_nil
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem is not default" do
    let(:default) { false }

    RSpec.shared_examples "#filesystem set to non-default btrfs" do
      it "sets #filesystem to the expected btrfs-related values" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(false)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end

    context "and the type is 'btrfs'" do
      let(:type) { "btrfs" }

      include_examples "#filesystem set to non-default btrfs"

      it "sets Btrfs snapshots to false" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(false)
      end
    end

    context "and the type is 'btrfsSnapshots'" do
      let(:type) { "btrfsSnapshots" }

      include_examples "#filesystem set to non-default btrfs"

      it "sets Btrfs snapshots to true" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
      end
    end

    context "and the type is 'btrfsImmutable'" do
      let(:type) { "btrfsImmutable" }

      include_examples "#filesystem set to non-default btrfs"

      it "sets Btrfs snapshots to true" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
      end
    end

    context "and the type is not 'btrfs'" do
      let(:type) { "xfs" }

      it "sets #filesystem to the expected value" do
        config = subject.convert
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(false)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
        expect(filesystem.type.btrfs).to be_nil
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem specifies 'reuse'" do
    let(:reuse) { true }

    it "sets #filesystem to the expected value" do
      config = subject.convert
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(true)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to eq("test")
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to be_empty
      expect(filesystem.mount_options).to be_empty
    end
  end

  context "if the filesystem does not specify 'type'" do
    let(:type) { nil }

    it "sets #filesystem to the expected value" do
      config = subject.convert
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to eq("test")
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
  end

  context "if the filesystem does not specify 'label'" do
    let(:label) { nil }

    it "sets #filesystem to the expected value" do
      config = subject.convert
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to be_nil
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
  end
end

shared_examples "with mountPath and filesystem" do
  let(:mountPath) { "/test" }

  let(:filesystem) do
    {
      default: false,
      type:    "btrfs",
      label:   "test"
    }
  end

  it "sets #filesystem to the expected value" do
    config = subject.convert
    filesystem = config.filesystem
    expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
    expect(filesystem.reuse?).to eq(false)
    expect(filesystem.type.default?).to eq(false)
    expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
    expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
    expect(filesystem.label).to eq("test")
    expect(filesystem.path).to eq("/test")
    expect(filesystem.mount_by).to be_nil
    expect(filesystem.mkfs_options).to be_empty
    expect(filesystem.mount_options).to be_empty
  end
end

shared_examples "with ptableType" do
  let(:ptableType) { "gpt" }

  it "sets #ptable_type to the expected value" do
    config = subject.convert
    expect(config.ptable_type).to eq(Y2Storage::PartitionTables::Type::GPT)
  end
end

shared_examples "with size" do
  context "if the size is default" do
    let(:size) do
      {
        default: true,
        min:     1.GiB.to_i,
        max:     10.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = subject.convert
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(true)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(10.GiB)
    end
  end

  context "if the size is not default" do
    let(:size) do
      {
        default: false,
        min:     1.GiB.to_i,
        max:     10.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = subject.convert
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(false)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(10.GiB)
    end
  end

  context "if the size does not spicify 'max'" do
    let(:size) do
      {
        default: false,
        min:     1.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = subject.convert
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(false)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(Y2Storage::DiskSize.unlimited)
    end
  end
end

shared_examples "with partitions" do
  context "with an empty list" do
    let(:partitions) { [] }

    it "sets #partitions to empty" do
      config = subject.convert
      expect(config.partitions).to eq([])
    end
  end

  context "with a list of partitions" do
    let(:partitions) do
      [
        { mountPath: "/" },
        { mountPath: "/test" }
      ]
    end

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(2)

      partition1, partition2 = partitions
      expect(partition1).to be_a(Agama::Storage::Configs::Partition)
      expect(partition1.filesystem.path).to eq("/")
      expect(partition2).to be_a(Agama::Storage::Configs::Partition)
      expect(partition2.filesystem.path).to eq("/test")
    end
  end
end

shared_examples "with spacePolicy" do
  context "if space policy is 'keep'" do
    let(:spacePolicy) { "keep" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end

  context "if space policy is 'delete'" do
    let(:spacePolicy) { "delete" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(true)
    end
  end

  context "if space policy is 'resize'" do
    let(:spacePolicy) { "resize" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(false)
      expect(partition.size.default?).to eq(false)
      expect(partition.size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partition.size.max).to be_nil
    end
  end

  context "if space policy is 'custom'" do
    let(:spacePolicy) { "custom" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end
end

shared_examples "with spacePolicy and partitions" do
  let(:partitions) do
    [
      # Reused partition with some usage.
      {
        name:      "/dev/vda1",
        mountPath: "/test1",
        size:      { default: true, min: 10.GiB.to_i }
      },
      # Reused partition with some usage.
      {
        name:           "/dev/vda2",
        mountPath:      "/test2",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Reused partition with some usage.
      {
        name:      "/dev/vda3",
        mountPath: "/test3",
        resize:    true,
        size:      { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Reused partition representing a space action (resize).
      {
        name:           "/dev/vda4",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Reused partition representing a space action (resize).
      {
        name:   "/dev/vda5",
        resize: true,
        size:   { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Reused partition representing a space action (delete).
      {
        name:   "/dev/vda6",
        delete: true
      },
      # Reused partition representing a space action (delete).
      {
        name:           "/dev/vda7",
        deleteIfNeeded: true
      },
      # Reused partition representing a space action (keep).
      {
        name: "/dev/vda8"
      },
      # New partition.
      {},
      # New partition.
      {
        mountPath:      "/",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i },
        filesystem:     { type: "btrfs" }
      }
    ]
  end

  context "if space policy is 'keep'" do
    let(:spacePolicy) { "keep" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(5)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
    end
  end

  context "if space policy is 'delete'" do
    let(:spacePolicy) { "delete" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(6)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to be_nil
      expect(partitions[5].search.max).to be_nil
      expect(partitions[5].delete).to eq(true)
    end
  end

  context "if space policy is 'resize'" do
    let(:spacePolicy) { "resize" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(6)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to be_nil
      expect(partitions[5].search.max).to be_nil
      expect(partitions[5].size.default?).to eq(false)
      expect(partitions[5].size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partitions[5].size.max).to be_nil
    end
  end

  context "if space policy is 'custom'" do
    let(:spacePolicy) { "custom" }

    it "sets #partitions to the expected value" do
      config = subject.convert
      partitions = config.partitions
      expect(partitions.size).to eq(9)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to eq("/dev/vda4")
      expect(partitions[6].search.name).to eq("/dev/vda5")
      expect(partitions[7].search.name).to eq("/dev/vda6")
      expect(partitions[8].search.name).to eq("/dev/vda7")
    end

    context "if a partition spicifies 'resizeIfNeeded'" do
      let(:partitions) { [{ resizeIfNeeded: resizeIfNeeded }] }

      context "if 'resizeIfNeeded' is true" do
        let(:resizeIfNeeded) { true }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(false)
          expect(size.min).to eq(Y2Storage::DiskSize.zero)
          expect(size.max).to be_nil
        end
      end

      context "if 'resizeIfNeeded' is false" do
        let(:resizeIfNeeded) { false }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to be_nil
          expect(size.max).to be_nil
        end
      end
    end

    context "if a partition spicifies both 'size' and 'resizeIfNeeded'" do
      let(:partitions) { [{ size: size, resizeIfNeeded: resizeIfNeeded }] }

      let(:size) do
        {
          default: true,
          min:     1.GiB.to_i,
          max:     10.GiB.to_i
        }
      end

      context "if 'resizeIfNeeded' is true" do
        let(:resizeIfNeeded) { true }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(false)
          expect(size.min).to eq(Y2Storage::DiskSize.zero)
          expect(size.max).to be_nil
        end
      end

      context "if 'resizeIfNeeded' is false" do
        let(:resizeIfNeeded) { false }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end
    end

    context "if a partition spicifies both 'size' and 'resize'" do
      let(:partitions) { [{ size: size, resize: resize }] }

      let(:size) do
        {
          default: true,
          min:     1.GiB.to_i,
          max:     10.GiB.to_i
        }
      end

      context "if 'resize' is true" do
        let(:resize) { true }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end

      context "if 'size' is false" do
        let(:resize) { false }

        it "sets #size to the expected value" do
          config = subject.convert
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end
    end

    context "if a partition specifies 'delete'" do
      let(:partitions) { [{ delete: true, mountPath: mount_path }] }

      let(:mount_path) { nil }

      it "sets #delete to true" do
        config = subject.convert
        partition = config.partitions.first
        expect(partition.delete?).to eq(true)
      end

      context "and the partition has a mount path" do
        let(:mount_path) { "/test" }

        it "sets #delete to false" do
          config = subject.convert
          partition = config.partitions.first
          expect(partition.delete?).to eq(false)
        end
      end
    end

    context "if a partition specifies 'deleteIfNeeded'" do
      let(:partitions) { [{ deleteIfNeeded: true, mountPath: mount_path }] }

      let(:mount_path) { nil }

      it "sets #delete_if_needed to true" do
        config = subject.convert
        partition = config.partitions.first
        expect(partition.delete_if_needed?).to eq(true)
      end

      context "and the partition has a mount path" do
        let(:mount_path) { "/test" }

        it "sets #delete_if_needed to false" do
          config = subject.convert
          partition = config.partitions.first
          expect(partition.delete_if_needed?).to eq(false)
        end
      end
    end
  end
end
