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

import React from "react";
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { Storage } from "~/model/system";
import DeviceSelectorModal from "./DeviceSelectorModal";

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevices: () => [],
}));

const sda: Storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "SDA drive",
  drive: {
    model: "Micron 1100 SATA",
    vendor: "Micron",
    bus: "IDE",
    busId: "",
    transport: "usb",
    driver: ["ahci", "mmcblk"],
    info: { dellBoss: false, sdCard: true },
  },
  block: {
    start: 1,
    size: 1024,
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const sdb: Storage.Device = {
  sid: 62,
  class: "drive",
  name: "/dev/sdb",
  description: "SDB drive",
  drive: {
    model: "Samsung Evo 8 Pro",
    vendor: "Samsung",
    bus: "IDE",
    busId: "",
    transport: "",
    info: { dellBoss: false, sdCard: false },
  },
  block: {
    start: 1,
    size: 2048,
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const md0: Storage.Device = {
  sid: 70,
  class: "mdRaid",
  name: "/dev/md0",
  description: "MD RAID 0",
  md: { level: "raid1", devices: [1, 2] },
  block: {
    start: 0,
    size: 10240,
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const vg0: Storage.Device = {
  sid: 80,
  class: "volumeGroup",
  name: "/dev/vg0",
  description: "Volume group 0",
  volumeGroup: { size: 51200, physicalVolumes: [1, 2] },
  logicalVolumes: [],
};

const onCancelMock = jest.fn();
const onConfirmMock = jest.fn();

describe("DeviceSelectorModal", () => {
  it("renders a modal dialog", () => {
    installerRender(
      <DeviceSelectorModal
        disks={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );
    screen.getByRole("dialog", { name: "Select a device" });
  });

  it("shows Disks, RAID, and LVM tabs", () => {
    installerRender(
      <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
    );
    screen.getByRole("tab", { name: "Disks" });
    screen.getByRole("tab", { name: "RAID" });
    screen.getByRole("tab", { name: "LVM" });
  });

  it("shows a description hinting at the tabbed layout", () => {
    installerRender(
      <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
    );
    screen.getByText(/Use the tabs to browse/);
  });

  it("renders the intro content above the tabs", () => {
    installerRender(
      <DeviceSelectorModal
        intro={<p>Introductory text</p>}
        title="Select"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );
    screen.getByText("Introductory text");
  });

  describe("initial tab", () => {
    it("opens the Disks tab by default", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      expect(screen.getByRole("tab", { name: "Disks" })).toHaveAttribute("aria-selected", "true");
    });

    it("opens the tab matching initialTab", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          mdRaids={[md0]}
          initialTab="mdRaids"
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      expect(screen.getByRole("tab", { name: "RAID" })).toHaveAttribute("aria-selected", "true");
    });

    it("opens the tab containing the selected device", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          volumeGroups={[vg0]}
          selected={vg0}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      expect(screen.getByRole("tab", { name: "LVM" })).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("sideEffectsAlert", () => {
    it("shows the disks alert in the footer when the selection differs from the given device", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda, sdb]}
          selected={sda}
          disksSideEffects={<p>Disk selection note</p>}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      const sdbRow = screen.getByRole("row", { name: /sdb/ });
      await user.click(within(sdbRow).getByRole("radio"));
      screen.getByText("Disk selection note");
    });

    it("shows the RAID alert in the footer when the selection differs from the given device", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          mdRaids={[md0]}
          selected={sda}
          mdRaidsSideEffects={<p>RAID selection note</p>}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      const mdRow = screen.getByRole("row", { name: /md0/ });
      await user.click(within(mdRow).getByRole("radio"));
      screen.getByText("RAID selection note");
    });

    it("shows the LVM alert in the footer when the selection differs from the given device", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          volumeGroups={[vg0]}
          selected={sda}
          volumeGroupsSideEffects={<p>LVM selection note</p>}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      const vgRow = screen.getByRole("row", { name: /vg0/ });
      await user.click(within(vgRow).getByRole("radio"));
      screen.getByText("LVM selection note");
    });

    it("does not show the alert when the selection matches the given device", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          selected={sda}
          disksSideEffects={<p>Disk selection note</p>}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      expect(screen.queryByText("Disk selection note")).toBeNull();
    });
  });

  describe("empty states", () => {
    it("shows an empty state in the Disks tab when no disks are given", () => {
      installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      screen.getByText("No disks found");
    });

    it("shows an empty state in the RAID tab when no RAID devices are given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      screen.getByText("No RAID devices found");
    });

    it("shows an empty state in the LVM tab when no volume groups are given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      screen.getByText("No LVM volume groups found");
    });

    it("shows the create link in the empty LVM state when newVolumeGroupLinkText is given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          newVolumeGroupLinkText="Define a new LVM"
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      screen.getByRole("link", { name: "Define a new LVM" });
    });

    it("does not show a create link in the empty LVM state when newVolumeGroupLinkText is not given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      expect(screen.queryByRole("link", { name: /create/i })).toBeNull();
    });

    it("does not show a create link in the empty RAID state", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      expect(screen.queryByRole("link", { name: /create/i })).toBeNull();
    });
  });

  describe("LVM tab with volume groups", () => {
    it("shows the create link when newVolumeGroupLinkText is given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          volumeGroups={[vg0]}
          newVolumeGroupLinkText="Define a new LVM"
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      screen.getByRole("link", { name: "Define a new LVM" });
    });

    it("does not show a create link when newVolumeGroupLinkText is not given", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          volumeGroups={[vg0]}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "LVM" }));
      expect(screen.queryByRole("link", { name: /create/i })).toBeNull();
    });
  });

  describe("autoSelectOnTabChange", () => {
    it("auto-selects the first device of the new tab by default", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          mdRaids={[md0]}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      screen.getByRole("button", { name: /Add.*md0/ });
    });

    it("clears the selection when switching to an empty tab by default", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          selected={sda}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      screen.getByRole("button", { name: "Change" });
    });

    it("keeps the current selection when false", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          mdRaids={[md0]}
          autoSelectOnTabChange={false}
          title="Select"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "RAID" }));
      screen.getByRole("button", { name: /Add.*sda/ });
    });
  });

  describe("actions", () => {
    it("triggers onCancel when user selects Cancel", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda, sdb]}
          title="Select a device"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancelMock).toHaveBeenCalled();
    });

    it("shows 'Add' when there is no prior device", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda]}
          title="Select a device"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      screen.getByRole("button", { name: /Add/ });
    });

    it("shows 'Keep' when the selection matches the given device", () => {
      installerRender(
        <DeviceSelectorModal
          disks={[sda, sdb]}
          selected={sda}
          title="Select a device"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      screen.getByRole("button", { name: /Keep/ });
    });

    it("shows 'Change to' when the selection differs from the given device", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda, sdb]}
          selected={sda}
          title="Select a device"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      const sdbRow = screen.getByRole("row", { name: /sdb/ });
      await user.click(within(sdbRow).getByRole("radio"));
      screen.getByRole("button", { name: /Change to/ });
    });

    it("shows a 'Select a device' hint when no devices are available", () => {
      installerRender(
        <DeviceSelectorModal title="Select" onCancel={onCancelMock} onConfirm={onConfirmMock} />,
      );
      screen.getByText("Select a device");
    });

    it("triggers onConfirm with the selected device when the user confirms", async () => {
      const { user } = installerRender(
        <DeviceSelectorModal
          disks={[sda, sdb]}
          selected={sda}
          title="Select a device"
          onCancel={onCancelMock}
          onConfirm={onConfirmMock}
        />,
      );
      const sdbRow = screen.getByRole("row", { name: /sdb/ });
      await user.click(within(sdbRow).getByRole("radio"));
      await user.click(screen.getByRole("button", { name: /Change to/ }));
      expect(onConfirmMock).toHaveBeenCalledWith([sdb]);
    });
  });
});
