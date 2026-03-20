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
import ConnectionForm from "~/components/network/ConnectionForm";
import { ConnectionMethod, ConnectionType, DeviceState } from "~/types/network";

const mockDevice1 = {
  name: "enp1s0",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
};

const mockDevice2 = {
  name: "enp2s0",
  type: ConnectionType.ETHERNET,
  state: DeviceState.DISCONNECTED,
};

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock("~/hooks/model/config/network", () => ({
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1, mockDevice2],
}));

describe("ConnectionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders common connection fields", () => {
    installerRender(<ConnectionForm />);
    screen.getByLabelText("Name");
    screen.getByLabelText("Interface");
    screen.getByLabelText("IPv4 Method");
    screen.getByLabelText("IPv6 Method");
  });

  it("defaults both methods to automatic and does not show gateways", () => {
    installerRender(<ConnectionForm />);
    expect(screen.getByLabelText("IPv4 Method")).toHaveValue(ConnectionMethod.AUTO);
    expect(screen.getByLabelText("IPv6 Method")).toHaveValue(ConnectionMethod.AUTO);
    expect(screen.queryByLabelText("IPv4 Gateway")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("IPv6 Gateway")).not.toBeInTheDocument();
  });

  it("shows IPv4 gateway when IPv4 method is manual", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.selectOptions(screen.getByLabelText("IPv4 Method"), ConnectionMethod.MANUAL);
    screen.getByLabelText("IPv4 Gateway");
    expect(screen.queryByLabelText("IPv6 Gateway")).not.toBeInTheDocument();
  });

  it("shows IPv6 gateway when IPv6 method is manual", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.selectOptions(screen.getByLabelText("IPv6 Method"), ConnectionMethod.MANUAL);
    screen.getByLabelText("IPv6 Gateway");
    expect(screen.queryByLabelText("IPv4 Gateway")).not.toBeInTheDocument();
  });

  it("submits with the entered values", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "Testing Connection 1", iface: "enp1s0" }),
      ),
    );
  });

  it("submits with gateways when both methods are manual", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.selectOptions(screen.getByLabelText("IPv4 Method"), ConnectionMethod.MANUAL);
    await user.type(screen.getByLabelText("IPv4 Gateway"), "192.168.1.1");
    await user.selectOptions(screen.getByLabelText("IPv6 Method"), ConnectionMethod.MANUAL);
    await user.type(screen.getByLabelText("IPv6 Gateway"), "::1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          method4: ConnectionMethod.MANUAL,
          gateway4: "192.168.1.1",
          method6: ConnectionMethod.MANUAL,
          gateway6: "::1",
        }),
      ),
    );
  });

  it("shows the error returned by server when the mutation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Connection failed"));
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByText("Connection failed");
  });
});
