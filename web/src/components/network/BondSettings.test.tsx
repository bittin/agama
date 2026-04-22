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

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { connectionFormOptions, validateConnectionForm } from "~/components/network/ConnectionForm";
import { BondMode, ConnectionType, DeviceState } from "~/types/network";
import BondSettings from "./BondSettings";

const mockDevice1 = {
  name: "enp1s0",
  macAddress: "00:11:22:33:44:55",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
};

const mockDevice2 = {
  name: "enp2s0",
  macAddress: "AA:BB:CC:DD:EE:FF",
  type: ConnectionType.ETHERNET,
  state: DeviceState.DISCONNECTED,
};

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1, mockDevice2],
}));

function TestForm({
  defaultValues = {},
  isEditing = false,
}: {
  defaultValues?: object;
  isEditing?: boolean;
}) {
  const form = useAppForm({
    ...connectionFormOptions,
    defaultValues: {
      ...connectionFormOptions.defaultValues,
      name: "test-bond",
      type: ConnectionType.BOND,
      ...defaultValues,
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const errors = validateConnectionForm(value);
        if (errors) return { fields: errors };
      },
    },
  });

  return (
    <form.AppForm>
      <BondSettings form={form} isEditing={isEditing} />
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting} onClick={() => form.handleSubmit()}>
            Accept
          </button>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}

describe("BondSettings", () => {
  it("renders bond fields", () => {
    installerRender(<TestForm />);

    screen.getByLabelText("Bond mode");
    screen.getByLabelText("Bond options");
    screen.getByText("Bond ports");
    screen.getByRole("textbox", { name: "Bond ports" });
    screen.getByText(/Available devices: enp1s0, enp2s0/);
  });

  it("allows defining the device name for a new bond connection", () => {
    installerRender(<TestForm />);

    const ifaceField = screen.getByLabelText("Device name");
    expect(ifaceField).toBeInTheDocument();
  });

  it("does not allow defining the device name when editing", () => {
    installerRender(<TestForm isEditing={true} />);

    expect(screen.queryByLabelText("Device name")).not.toBeInTheDocument();
  });

  it("shows an error when no bond ports are selected", async () => {
    const { user } = installerRender(<TestForm />);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await screen.findByText("At least one bond port is required");
  });

  it("shows an error when 'primary' option is used with an invalid bond mode", async () => {
    const { user } = installerRender(<TestForm />);

    // Default mode is balance-rr, which does not support 'primary'
    await user.type(screen.getByLabelText("Bond options"), "primary=enp1s0{enter}");
    await user.type(screen.getByRole("textbox", { name: "Bond ports" }), "enp1s0{enter}");

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await screen.findByText(
      "The 'primary' option is only valid for 'active-backup', 'balance-tlb', and 'balance-alb' modes",
    );
  });

  it("allows 'primary' option with active-backup mode", async () => {
    const { user } = installerRender(
      <TestForm defaultValues={{ bondMode: BondMode.ACTIVE_BACKUP }} />,
    );

    await user.type(screen.getByLabelText("Bond options"), "primary=enp1s0{enter}");
    await user.type(screen.getByRole("textbox", { name: "Bond ports" }), "enp1s0{enter}");

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          "The 'primary' option is only valid for 'active-backup', 'balance-tlb', and 'balance-alb' modes",
        ),
      ).not.toBeInTheDocument();
    });
  });
});
