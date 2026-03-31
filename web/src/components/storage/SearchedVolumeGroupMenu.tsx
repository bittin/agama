/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useState } from "react";
import MenuButton, { CustomToggleProps, MenuButtonItem } from "~/components/core/MenuButton";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useConvertDevice,
  useDeleteVolumeGroup,
} from "~/hooks/model/storage/config-model";
import { formattedPath } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { MenuItemProps } from "@patternfly/react-core";
import { isEmpty, isNullish } from "radashi";
import { isVolumeGroup } from "~/model/storage/device";
import type { Storage } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import type { DeviceSelectorModalProps } from "~/components/storage/DeviceSelectorModal";

/**
 * Filters devices that can be selected as target for the volume group.
 */
const targetDevices = (
  config: ConfigModel.Config,
  availableDevices: Storage.Device[],
): Storage.Device[] => {
  return availableDevices.filter((availableDevice) => {
    const availableDeviceConfig = configModel.findDevice(config, availableDevice.name);

    // Allow to select the available device if it is not configured yet.
    if (isNullish(availableDeviceConfig)) return true;

    // The available device cannot be selected if it is configured to be formatted.
    if ("filesystem" in availableDeviceConfig) return !availableDeviceConfig.filesystem;

    return true;
  });
};

const isUnchangeable = (deviceConfig: ConfigModel.VolumeGroup): boolean => {
  return configModel.volumeGroup.isReusingLogicalVolumes(deviceConfig);
};

type ChangeVolumeGroupTitleProps = {
  deviceConfig: ConfigModel.VolumeGroup;
};

const ChangeVolumeGroupTitle = ({ deviceConfig }: ChangeVolumeGroupTitleProps) => {
  if (isUnchangeable(deviceConfig)) {
    return _("Selected volume group cannot be changed");
  }

  const mountPaths = configModel.volumeGroup.usedMountPaths(deviceConfig);
  const hasMountPaths = !isEmpty(mountPaths.length);

  if (!hasMountPaths) {
    return _("Change the volume group to configure");
  }

  if (mountPaths.includes("/")) {
    return _("Change the volume group to install the system");
  }

  const newMountPaths = deviceConfig.logicalVolumes
    .filter((l) => !l.name)
    .map((l) => formattedPath(l.mountPath));

  return sprintf(
    // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
    // single mount point in the singular case).
    _("Change the volume group to create %s"),
    formatList(newMountPaths),
  );
};

type ChangeVolumeGroupDescriptionProps = {
  deviceConfig: ConfigModel.VolumeGroup;
};

const ChangeVolumeGroupDescription = ({ deviceConfig }: ChangeVolumeGroupDescriptionProps) => {
  const isReusingLogicalVolumes = configModel.volumeGroup.isReusingLogicalVolumes(deviceConfig);

  if (isReusingLogicalVolumes) {
    // The current volume group will be the only option to choose from
    return _("This uses existing logical volumes at the volume group");
  }
};

const ReuseDriveTitle = () => _("Change to an existing disk");

type ReuseDriveDescriptionProps = {
  deviceConfig: ConfigModel.VolumeGroup;
};

const ReuseDriveDescription = ({ deviceConfig }: ReuseDriveDescriptionProps) => {
  const paths = deviceConfig.logicalVolumes
    .filter((l) => !l.name)
    .map((l) => formattedPath(l.mountPath));

  if (paths.length) {
    return sprintf(
      n_(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        "%s will be created as a partition",
        "%s will be created as partitions",
        paths.length,
      ),
      formatList(paths),
    );
  }
};

type ChangeVolumeGroupMenuItemProps = {
  deviceConfig: ConfigModel.VolumeGroup;
  device: Storage.Device;
} & MenuItemProps;

const ChangeVolumeGroupMenuItem = ({
  deviceConfig,
  device,
  ...props
}: ChangeVolumeGroupMenuItemProps): React.ReactNode => {
  const unchangeable = isUnchangeable(deviceConfig);

  return (
    <MenuButtonItem
      aria-label={_("Change volume group menu")}
      description={<ChangeVolumeGroupDescription deviceConfig={deviceConfig} />}
      isDisabled={unchangeable}
      {...props}
    >
      <ChangeVolumeGroupTitle deviceConfig={deviceConfig} />
    </MenuButtonItem>
  );
};

type ReuseDiskMenuItemProps = {
  deviceConfig: ConfigModel.VolumeGroup;
  device: Storage.Device;
} & MenuItemProps;

const ReuseDriveMenuItem = ({
  deviceConfig,
  device,
  ...props
}: ReuseDiskMenuItemProps): React.ReactNode => {
  if (isUnchangeable(deviceConfig)) return;

  return (
    <MenuButtonItem
      aria-label={_("Reuse disk menu")}
      description={<ReuseDriveDescription deviceConfig={deviceConfig} />}
      {...props}
    >
      <ReuseDriveTitle />
    </MenuButtonItem>
  );
};

type RemoveVolumeGroupMenuItemProps = {
  deviceConfig: ConfigModel.VolumeGroup;
};

const RemoveVolumeGroupMenuItem = ({
  deviceConfig,
}: RemoveVolumeGroupMenuItemProps): React.ReactNode => {
  const config = useConfigModel();
  const deleteVolumeGroup = useDeleteVolumeGroup();

  // When no additional devices has been added, the "Do not use" button can be confusing so it is
  // omitted for all volume groups.
  if (!configModel.hasAdditionalDevices(config)) return;

  const deleteFn = () => deleteVolumeGroup(deviceConfig.vgName, false);
  const description = _("Remove the configuration for this volume group");

  return (
    <MenuButtonItem key="delete" isDanger description={description} onClick={deleteFn}>
      {_("Do not use")}
    </MenuButtonItem>
  );
};

type SearchedVolumeGroupSelectorModalProps = Omit<SearchedDeviceSelectorProps, "reuseDrive">;

const SearchedVolumeGroupSelectorModal = ({
  device,
  deviceConfig,
  ...deviceSelectorModalProps
}: SearchedVolumeGroupSelectorModalProps): React.ReactNode => {
  const volumeGroups = targetDevices(useConfigModel(), useAvailableDevices()).filter(isVolumeGroup);

  return (
    <DeviceSelectorModal
      {...deviceSelectorModalProps}
      title={<ChangeVolumeGroupTitle deviceConfig={deviceConfig} />}
      description={<ChangeVolumeGroupDescription deviceConfig={deviceConfig} />}
      selected={device}
      devices={volumeGroups}
    />
  );
};

type SearchedDriveSelectorModalProps = Omit<SearchedDeviceSelectorProps, "reuseDrive">;

const SearchedDriveSelectorModal = ({
  device,
  deviceConfig,
  ...deviceSelectorModalProps
}: SearchedDriveSelectorModalProps): React.ReactNode => {
  const devices = targetDevices(useConfigModel(), useAvailableDevices()).filter(
    (d) => !isVolumeGroup(d),
  );

  return (
    <DeviceSelectorModal
      {...deviceSelectorModalProps}
      title={<ReuseDriveTitle />}
      description={<ReuseDriveDescription deviceConfig={deviceConfig} />}
      selected={device}
      devices={devices}
    />
  );
};

type SearchedDeviceSelectorProps = Omit<DeviceSelectorModalProps, "devices" | "selected"> & {
  device: Storage.Device;
  deviceConfig: ConfigModel.VolumeGroup;
  reuseDrive: boolean;
};

const SearchedDeviceSelector = ({
  reuseDrive,
  ...modalProps
}: SearchedDeviceSelectorProps): React.ReactNode => {
  if (reuseDrive) return <SearchedDriveSelectorModal {...modalProps} />;

  return <SearchedVolumeGroupSelectorModal {...modalProps} />;
};

export type SearchedVolumeGroupMenuProps = {
  deviceConfig: ConfigModel.VolumeGroup;
  device: Storage.Device;
  toggle?: React.ReactElement<CustomToggleProps>;
};

/**
 * Menu that provides options for users to configure the device used by a configuration
 * entry that represents a volume group previously existing in the system.
 */
export default function SearchedVolumeGroupMenu({
  deviceConfig,
  device,
  toggle,
}: SearchedVolumeGroupMenuProps): React.ReactNode {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [reuseDrive, setReuseDrive] = useState(false);
  const convertDevice = useConvertDevice();

  const onDeviceChange = ([targetDevice]: Storage.Device[]) => {
    setIsSelectorOpen(false);
    convertDevice(device.name, targetDevice.name);
  };

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": sprintf(_("Volume group %s menu"), deviceConfig.name),
          // popperProps: { position: "end", maxWidth: "fit-content", minWidth: "fit-content" },
        }}
        customToggle={toggle}
        items={[
          <ChangeVolumeGroupMenuItem
            key="change-device-option"
            deviceConfig={deviceConfig}
            device={device}
            onClick={() => {
              setReuseDrive(false);
              setIsSelectorOpen(true);
            }}
          />,
          <ReuseDriveMenuItem
            key="reuse-drive-option"
            deviceConfig={deviceConfig}
            device={device}
            onClick={() => {
              setReuseDrive(true);
              setIsSelectorOpen(true);
            }}
          />,
          <RemoveVolumeGroupMenuItem
            key="remove-volume-group-option"
            deviceConfig={deviceConfig}
          />,
        ]}
      />
      {isSelectorOpen && (
        <SearchedDeviceSelector
          deviceConfig={deviceConfig}
          device={device}
          reuseDrive={reuseDrive}
          onConfirm={onDeviceChange}
          onCancel={() => setIsSelectorOpen(false)}
        />
      )}
    </>
  );
}
