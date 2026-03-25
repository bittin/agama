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

  it("renders common connection fields and options", () => {
    installerRender(<ConnectionForm />);
    screen.getByLabelText("Name");
    screen.getByLabelText("Interface");
    screen.getByText("IPv4 Settings");
    screen.getByText("IPv6 Settings");
    screen.getByText("Use custom DNS");
    screen.getByText("Use custom DNS search domains");
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

  it("shows the error returned by server when the mutation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Connection failed"));
    const { user } = installerRender(<ConnectionForm />);
    await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByText("Connection failed");
  });

  it("does not show IP fields when both settings are default", () => {
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

  it("shows the IPv4 addresses and gateway when IPv4 mode is mixed", async () => {
    const { user } = installerRender(<ConnectionForm />);
    await user.click(screen.getByLabelText("IPv4 Settings"));
    await user.click(screen.getByRole("option", { name: /^Mixed/ }));
    screen.getByText("IPv4 Addresses");
    screen.getByLabelText("IPv4 Gateway (optional, ignored if no addresses provided)");
    expect(screen.queryByText("IPv6 Addresses")).not.toBeInTheDocument();
  });

  it("submits empty addresses when both settings are default", async () => {
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
    await user.type(screen.getByLabelText("IPv4 Addresses"), "192.168.1.100 192.168.1.200/12");
    await user.type(screen.getByLabelText("IPv4 Gateway (optional)"), "192.168.1.1");

    await user.click(screen.getByLabelText("IPv6 Settings"));
    await user.click(screen.getByRole("option", { name: /^Manual/ }));
    await user.type(screen.getByLabelText("IPv6 Addresses"), "2001:db8::1 2001:db8::2/24");
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
      screen.getByRole("textbox", { name: "DNS servers" });
    });

    it("submits with parsed nameservers when checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Use custom DNS"));
      await user.type(
        screen.getByRole("textbox", { name: "DNS servers" }),
        "8.8.8.8 1.1.1.1 2001:db8::1",
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
      await user.type(screen.getByRole("textbox", { name: "DNS servers" }), "8.8.8.8");
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ nameservers: [] })),
      );
    });
  });

  describe("DNS search domains", () => {
    it("does not show the DNS search domains field by default", () => {
      installerRender(<ConnectionForm />);
      expect(screen.queryByRole("textbox", { name: "DNS search domains" })).not.toBeInTheDocument();
    });

    it("shows the DNS search domains field when the checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.click(screen.getByLabelText("Use custom DNS search domains"));
      screen.getByRole("textbox", { name: "DNS search domains" });
    });

    it("submits with parsed dnsSearchList when checkbox is checked", async () => {
      const { user } = installerRender(<ConnectionForm />);
      await user.type(screen.getByLabelText("Name"), "Testing Connection 1");
      await user.click(screen.getByLabelText("Use custom DNS search domains"));
      await user.type(
        screen.getByRole("textbox", { name: "DNS search domains" }),
        "example.com local.lan",
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
      await user.type(screen.getByRole("textbox", { name: "DNS search domains" }), "example.com");
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
