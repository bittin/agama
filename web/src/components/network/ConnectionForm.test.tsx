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
import { installerRender, mockParams } from "~/test-utils";
import { Connection, ConnectionMethod, ConnectionState, ConnectionStatus, ConnectionType, DeviceState } from "~/types/network";
import ConnectionForm from "~/components/network/ConnectionForm";

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

const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockUseConfig = jest.fn().mockReturnValue({ connections: [] });
const mockUseSystem = jest.fn().mockReturnValue({ connections: [] });

jest.mock("~/hooks/model/config/network", () => ({
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
  useConfig: () => mockUseConfig(),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1, mockDevice2],
  useSystem: () => mockUseSystem(),
}));

/** Builds a Connection instance from minimal API data, with sensible defaults. */
const makeConnection = (id: string, overrides = {}) =>
  Connection.fromApi({
    id,
    status: ConnectionStatus.UP,
    state: ConnectionState.activated,
    persistent: true,
    addresses: [],
    nameservers: [],
    dnsSearchList: [],
    ...overrides,
  });

describe("ConnectionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({});
  });

  it("renders common connection fields and options", () => {
    installerRender(<ConnectionForm />);
    screen.getByLabelText("Name");
    screen.getByLabelText("Device");
    screen.getByText("IPv4 Settings");
    screen.getByText("IPv6 Settings");
    screen.getByText("Use custom DNS");
    screen.getByText("Use custom DNS search domains");
  });

  describe("Device binding", () => {
    it("does not show device or MAC fields when mode is Any", () => {
      installerRender(<ConnectionForm />);
      expect(screen.queryByLabelText("Device name")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("MAC address")).not.toBeInTheDocument();
    });

    it("submits with iface when binding by iface name", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Device"));
      await user.click(screen.getByRole("option", { name: /^Chosen by name/ }));
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ iface: "enp1s0" })),
      );
    });

    it("submits with macAddress when binding by MAC", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Device"));
      await user.click(screen.getByRole("option", { name: /^Chosen by MAC/ }));
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ macAddress: "00:11:22:33:44:55" }),
        ),
      );
    });
  });

  it("submits with the entered values", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "Testing Connection 1" }),
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

  it("does not show IP fields when both settings are automatic", () => {
    installerRender(<ConnectionForm />);
    expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv4 Gateway")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv6 Addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv6 Gateway")).not.toBeInTheDocument();
  });

  it("shows the IPv4 addresses and gateway when IPv4 settings is manual", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.click(screen.getByLabelText("IPv4 Settings"));
    await user.click(screen.getByRole("option", { name: /^Manual/ }));
    screen.getByText("IPv4 Addresses");
    screen.getByLabelText("IPv4 Gateway (optional)");
    expect(screen.queryByLabelText("IPv6 Gateway (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv6 Addresses")).not.toBeInTheDocument();
  });

  it("shows the IPv4 addresses and gateway when IPv4 mode is advanced", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.click(screen.getByLabelText("IPv4 Settings"));
    await user.click(screen.getByRole("option", { name: /^Advanced/ }));
    screen.getByText("IPv4 Addresses");
    screen.getByLabelText("IPv4 Gateway (optional, ignored if no addresses provided)");
    expect(screen.queryByText("IPv6 Addresses")).not.toBeInTheDocument();
  });

  it("submits empty addresses when both settings are automatic", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ addresses: [] })),
    );
  });

  it("submits with given addresses and gateways when both protocols are set to manual", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");

    await user.click(screen.getByLabelText("IPv4 Settings"));
    await user.click(screen.getByRole("option", { name: /^Manual/ }));
    await user.type(
      screen.getByLabelText("IPv4 Addresses"),
      "192.168.1.100{Enter}192.168.1.200/12{Enter}",
    );
    await user.type(screen.getByLabelText("IPv4 Gateway (optional)"), "192.168.1.1");

    await user.click(screen.getByLabelText("IPv6 Settings"));
    await user.click(screen.getByRole("option", { name: /^Manual/ }));
    await user.type(
      screen.getByLabelText("IPv6 Addresses"),
      "2001:db8::1{Enter}2001:db8::2/24{Enter}",
    );
    await user.type(screen.getByLabelText("IPv6 Gateway (optional)"), "::1");

    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [
            // adds a default prefix since it has none
            { address: "192.168.1.100", prefix: 24 },
            { address: "192.168.1.200", prefix: 12 },
            // adds a default prefix since it has none
            { address: "2001:db8::1", prefix: 64 },
            { address: "2001:db8::2", prefix: 24 },
          ],
          method4: ConnectionMethod.MANUAL,
          gateway4: "192.168.1.1",
          method6: ConnectionMethod.MANUAL,
          gateway6: "::1",
        }),
      ),
    );
  });

  describe("DNS servers", () => {
    it("does not show the DNS servers field by default", () => {
      installerRender(<ConnectionForm />);
      expect(screen.queryByRole("textbox", { name: "DNS servers" })).not.toBeInTheDocument();
    });

    it("shows the DNS servers field when the checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.click(screen.getByLabelText("Use custom DNS"));
      screen.getByLabelText("DNS servers");
    });

    it("submits with parsed nameservers when checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Use custom DNS"));
      await user.type(
        screen.getByLabelText("DNS servers"),
        "8.8.8.8{Enter}1.1.1.1{Enter}2001:db8::1{Enter}",
      );
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ nameservers: ["8.8.8.8", "1.1.1.1", "2001:db8::1"] }),
        ),
      );
    });

    it("submits empty nameservers when checkbox is unchecked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      const checkbox = screen.getByRole("checkbox", { name: "Use custom DNS" });
      await user.click(checkbox);
      await user.type(screen.getByLabelText("DNS servers"), "8.8.8.8{Enter}");
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ nameservers: [] })),
      );
    });
  });

  describe("when editing an existing connection", () => {
    beforeEach(() => {
      mockParams({ id: "eth0" });
      mockUseSystem.mockReturnValue({ connections: [makeConnection("eth0")] });
    });

    it("does not show the name field since it cannot be changed", () => {
      installerRender(<ConnectionForm />);
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("pre-selects Manual IPv4 when the connection uses manual IPv4 addressing", () => {
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "manual", addresses: ["192.168.1.1/24"] })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByText("IPv4 Addresses")).toBeInTheDocument();
    });

    it("pre-selects Manual IPv6 when the connection uses manual IPv6 addressing", () => {
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "manual", addresses: ["2001:db8::1/64"] })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByText("IPv6 Addresses")).toBeInTheDocument();
    });

    it("pre-checks custom DNS when the connection has nameservers", () => {
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { nameservers: ["8.8.8.8"] })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByRole("checkbox", { name: "Use custom DNS" })).toBeChecked();
    });

    it("pre-checks custom DNS search domains when the connection has search domains", () => {
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { dnsSearchList: ["example.com"] })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByRole("checkbox", { name: "Use custom DNS search domains" })).toBeChecked();
    });

    it("submits the updated connection when accepting the form", async () => {
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { nameservers: ["8.8.8.8"] })],
      });
      const { user } = installerRender(<ConnectionForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ id: "eth0", nameservers: ["8.8.8.8"] }),
        ),
      );
    });
  });

  describe("when merging config and system connections for editing", () => {
    beforeEach(() => {
      mockParams({ id: "eth0" });
    });

    it("shows Automatic IPv4 when config has no method, despite system reporting auto", () => {
      mockUseConfig.mockReturnValue({ connections: [makeConnection("eth0")] });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "auto" })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    });

    it("shows Manual IPv4 when config sets method4 to manual, despite system reporting auto", () => {
      mockUseConfig.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "manual", addresses: ["192.168.1.1/24"] })],
      });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "auto" })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByText("IPv4 Addresses")).toBeInTheDocument();
    });

    it("shows Advanced IPv4 when config sets method4 to auto, despite system reporting manual", () => {
      mockUseConfig.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "auto" })],
      });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method4: "manual", addresses: ["192.168.1.1/24"] })],
      });
      installerRender(<ConnectionForm />);
      expect(
        screen.getByLabelText("IPv4 Gateway (optional, ignored if no addresses provided)"),
      ).toBeInTheDocument();
    });

    it.todo(
      "shows Advanced IPv4 when config has no method but system already has IPv4 addresses",
    );

    it("shows Automatic IPv6 when config has no method, despite system reporting auto", () => {
      mockUseConfig.mockReturnValue({ connections: [makeConnection("eth0")] });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "auto" })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.queryByText("IPv6 Addresses")).not.toBeInTheDocument();
    });

    it("shows Manual IPv6 when config sets method6 to manual, despite system reporting auto", () => {
      mockUseConfig.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "manual", addresses: ["2001:db8::1/64"] })],
      });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "auto" })],
      });
      installerRender(<ConnectionForm />);
      expect(screen.getByText("IPv6 Addresses")).toBeInTheDocument();
    });

    it("shows Advanced IPv6 when config sets method6 to auto, despite system reporting manual", () => {
      mockUseConfig.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "auto" })],
      });
      mockUseSystem.mockReturnValue({
        connections: [makeConnection("eth0", { method6: "manual", addresses: ["2001:db8::1/64"] })],
      });
      installerRender(<ConnectionForm />);
      expect(
        screen.getByLabelText("IPv6 Gateway (optional, ignored if no addresses provided)"),
      ).toBeInTheDocument();
    });

    it.todo(
      "shows Advanced IPv6 when config has no method but system already has IPv6 addresses",
    );
  });

  describe("DNS search domains", () => {
    it("does not show the DNS search domains field by default", () => {
      installerRender(<ConnectionForm />);
      expect(screen.queryByRole("textbox", { name: "DNS search domains" })).not.toBeInTheDocument();
    });

    it("shows the DNS search domains field when the checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.click(screen.getByLabelText("Use custom DNS search domains"));
      screen.getByLabelText("DNS search domains");
    });

    it("submits with parsed dnsSearchList when checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Use custom DNS search domains"));
      await user.type(
        screen.getByLabelText("DNS search domains"),
        "example.com{Enter}local.lan{Enter}",
      );
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ dnsSearchList: ["example.com", "local.lan"] }),
        ),
      );
    });

    it("submits empty dnsSearchList when checkbox is unchecked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      const checkbox = screen.getByRole("checkbox", { name: "Use custom DNS search domains" });
      await user.click(checkbox);
      await user.type(screen.getByLabelText("DNS search domains"), "example.com{Enter}");
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ dnsSearchList: [] }),
        ),
      );
    });
  });
});
