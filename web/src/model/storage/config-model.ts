/*
 * Copyright (c) [2025-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import boot from "~/model/storage/config-model/boot";
import partitionable from "~/model/storage/config-model/partitionable";
import drive from "~/model/storage/config-model/drive";
import mdRaid from "~/model/storage/config-model/md-raid";
import partition from "~/model/storage/config-model/partition";
import volumeGroup from "~/model/storage/config-model/volume-group";
import logicalVolume from "~/model/storage/config-model/logical-volume";
import { compact } from "~/utils";
import { sift } from "radashi";
import type * as ConfigModel from "~/openapi/storage/config-model";
import type * as Partitionable from "~/model/storage/config-model/partitionable";
import type * as Data from "~/model/storage/config-model/data";
import type { Storage as System } from "~/model/system";

function clone(config: ConfigModel.Config): ConfigModel.Config {
  return JSON.parse(JSON.stringify(config));
}

function usedMountPaths(config: ConfigModel.Config): string[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  const volumeGroups = config.volumeGroups || [];

  return [
    ...drives.flatMap(partitionable.usedMountPaths),
    ...mdRaids.flatMap(partitionable.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroup.usedMountPaths),
  ];
}

function isTargetDevice(config: ConfigModel.Config, deviceName: string): boolean {
  const targetDevices = (config.volumeGroups || []).flatMap((v) => v.targetDevices || []);
  return targetDevices.includes(deviceName);
}

function setEncryption(
  config: ConfigModel.Config,
  encryption?: ConfigModel.Encryption,
): ConfigModel.Config {
  config = clone(config);
  config.encryption = encryption;
  return config;
}

function findDevice(
  config: ConfigModel.Config,
  deviceName: string,
): ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup | undefined {
  const devices = compact([config.drives, config.mdRaids, config.volumeGroups]).flat();
  return devices.find((d) => d.name === deviceName);
}

function convertPartitionable(
  model: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
) {
  if (targetDevice.class === "drive") {
    return partitionable.convertToDrive(model, device.name, {
      name: targetDevice.name,
    });
  }
  if (targetDevice.class === "mdRaid") {
    return partitionable.convertToMdRaid(model, device.name, {
      name: targetDevice.name,
    });
  }
  if (targetDevice.class === "volumeGroup") {
    return partitionable.convertToVolumeGroup(model, device.name, targetDevice.name);
  }
}

const extractVgName = (name: string) => name.split("/").pop();

function convertVolumeGroup(
  model: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
) {
  const vgName = extractVgName(device.name);
  if (targetDevice.class === "drive") {
    return volumeGroup.convertToDrive(model, vgName, targetDevice.name);
  }
  if (targetDevice.class === "mdRaid") {
    return volumeGroup.convertToMdRaid(model, vgName, targetDevice.name);
  }
  if (targetDevice.class === "volumeGroup") {
    const targetVgName = extractVgName(targetDevice.name);
    return volumeGroup.convertToVolumeGroup(model, vgName, targetVgName);
  }
}

function convertDevice(
  model: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
): ConfigModel.Config {
  if (device.class === "drive") return convertPartitionable(model, device, targetDevice);
  if (device.class === "mdRaid") return convertPartitionable(model, device, targetDevice);
  if (device.class === "volumeGroup") return convertVolumeGroup(model, device, targetDevice);

  return model;
}

/*
 * Pretty artificial logic used to decide whether the UI should display buttons to remove some
 * devices.
 */
function hasAdditionalDevices(config: ConfigModel.Config): boolean {
  const entries = sift([config.drives, config.mdRaids, config.volumeGroups]).flat();

  if (entries.length <= 1) return false;
  if (entries.length > 2) return true;

  // If there are only two devices, the following logic avoids the corner case in which first
  // deleting one of them and then changing the boot settings can lead to zero disks. But it is
  // far from being fully reasonable or understandable for the user.
  const onlyToBoot = entries.find(
    (e) => boot.hasExplicitDevice(config, e.name) && !partitionable.isUsed(config, e.name),
  );

  return !onlyToBoot;
}

export default {
  clone,
  usedMountPaths,
  isTargetDevice,
  setEncryption,
  findDevice,
  convertDevice,
  hasAdditionalDevices,
  boot,
  partitionable,
  drive,
  mdRaid,
  partition,
  volumeGroup,
  logicalVolume,
};
export type { ConfigModel, Data, Partitionable };
