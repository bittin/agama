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
import IpSettings from "./IpSettings";

const FIELD_NAMES = {
  mode:      "ipv4Mode",
  addresses: "addresses4",
  gateway:   "gateway4",
};

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    defaultValues: {
      ipv4Mode:   "default",
      addresses4: "",
      gateway4:   "",
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

  it("does not show addresses or gateway when mode is default", () => {
    installerRender(<TestForm />);
    expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv4 Gateway")).not.toBeInTheDocument();
  });

  it("does not show addresses or gateway when mode is automatic", () => {
    installerRender(<TestForm defaultValues={{ ipv4Mode: "auto" }} />);
    expect(screen.queryByText("IPv4 Addresses")).not.toBeInTheDocument();
    expect(screen.queryByText("IPv4 Gateway")).not.toBeInTheDocument();
  });

  describe("when mode is manual", () => {
    const defaultValues = { ipv4Mode: "manual" };

    it("shows IPv4 Addresses as required", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Addresses").closest("label")).not.toHaveTextContent("(optional)");
    });

    it("shows IPv4 Gateway as optional", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent("(optional)");
    });

    it("does not note that the gateway is ignored without a static IP", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).not.toHaveTextContent("ignored");
    });
  });

  describe("when mode is mixed", () => {
    const defaultValues = { ipv4Mode: "mixed" };

    it("shows IPv4 Addresses as optional", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Addresses").closest("label")).toHaveTextContent("(optional)");
    });

    it("notes on the gateway label that it is ignored if no addresses provided", () => {
      installerRender(<TestForm defaultValues={defaultValues} />);
      expect(screen.getByText("IPv4 Gateway").closest("label")).toHaveTextContent(
        "(optional, ignored if no addresses provided)",
      );
    });
  });
});
