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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { ConnectionMethod } from "~/types/network";
import IpSettings from "./IpSettings";

const FIELD_NAMES = {
  mode:        "ipv4Mode",
  method:      "method4",
  addresses:   "addresses4",
  gateway:     "gateway4",
  nameservers: "nameservers4",
  useExtra:    "useExtra4",
};

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    defaultValues: {
      ipv4Mode:    "default",
      method4:     ConnectionMethod.AUTO,
      addresses4:  "",
      gateway4:    "",
      nameservers4: "",
      useExtra4:   false,
      ...defaultValues,
    },
  });

  return (
    <form.AppForm>
      <IpSettings protocol="ipv4" fieldNames={FIELD_NAMES} />
    </form.AppForm>
  );
}

describe("IpSettings", () => {
  it("renders the protocol label", () => {
    installerRender(<TestForm />);
    screen.getByText("IPv4 Settings");
  });

  it("does not show the method selector when mode is default", () => {
    installerRender(<TestForm />);
    expect(screen.queryByText("IPv4 Method")).not.toBeInTheDocument();
  });

  it("shows the method selector when mode is custom", () => {
    installerRender(<TestForm defaultValues={{ ipv4Mode: "custom" }} />);
    screen.getByText("IPv4 Method");
  });

  describe("when method is manual", () => {
    const defaultValues = { ipv4Mode: "custom", method4: ConnectionMethod.MANUAL };

    it("shows IP Addresses as required and Gateway and DNS as optional", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);

      expect(screen.getByText("IPv4 Addresses").closest("label")).not.toHaveTextContent("(optional)");
      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent("(optional)");
      expect(screen.getByText("IPv4 DNS servers").closest("label")).toHaveTextContent("(optional)");
    });

    it("does not show the 'ignored without a static IP' note on the gateway", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).not.toHaveTextContent("ignored");
    });
  });

  describe("when method is automatic", () => {
    const defaultValues = { ipv4Mode: "custom", method4: ConnectionMethod.AUTO };

    it("shows the extra settings checkbox", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText("With extra IPv4 settings");
    });

    it("does not show extra fields when the checkbox is unchecked", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    });

    it("shows all extra fields as optional when the checkbox is checked", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByText("With extra IPv4 settings"));

      expect(screen.getByText("IPv4 Addresses").closest("label")).toHaveTextContent("(optional)");
      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent("(optional, ignored without a static IP)");
      expect(screen.getByText("IPv4 DNS servers").closest("label")).toHaveTextContent("(optional)");
    });

    it("notes on the gateway label that it is ignored without a static IP", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByText("With extra IPv4 settings"));

      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent(
        "ignored without a static IP",
      );
    });
  });
});
