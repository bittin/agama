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
    expect(screen.queryByText("Method")).not.toBeInTheDocument();
  });

  it("shows the method selector when mode is custom", () => {
    installerRender(<TestForm defaultValues={{ ipv4Mode: "custom" }} />);
    screen.getByText("Method");
  });

  describe("when method is manual", () => {
    const defaultValues = { ipv4Mode: "custom", method4: ConnectionMethod.MANUAL };

    it("shows IP Addresses as required and Gateway and DNS as optional", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);

      expect(screen.getByText("IP Addresses").closest("label")).not.toHaveTextContent("(optional)");
      expect(screen.getByText("Gateway").closest("label")).toHaveTextContent("(optional)");
      expect(screen.getByText("DNS servers").closest("label")).toHaveTextContent("(optional)");
    });
  });

  describe("when method is automatic", () => {
    const defaultValues = { ipv4Mode: "custom", method4: ConnectionMethod.AUTO };

    it("shows the extra settings checkbox", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      screen.getByText("Add extra network settings");
    });

    it("does not show extra fields when the checkbox is unchecked", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.queryByText("IP Addresses")).not.toBeInTheDocument();
    });

    it("shows all extra fields as optional when the checkbox is checked", async () => {
      const { user } = installerRender(<TestForm defaultValues={defaultValues} />);
      await user.click(screen.getByText("Add extra network settings"));

      expect(screen.getByText("IP Addresses").closest("label")).toHaveTextContent("(optional)");
      expect(screen.getByText("Gateway").closest("label")).toHaveTextContent("(optional)");
      expect(screen.getByText("DNS servers").closest("label")).toHaveTextContent("(optional)");
    });
  });
});
