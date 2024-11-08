/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { installerRender, mockRoutes } from "~/test-utils";
import { InstallButton } from "~/components/core";
import { IssuesList } from "~/types/issues";
import { PATHS as PRODUCT_PATHS } from "~/routes/products";

const mockStartInstallationFn = jest.fn();
let mockIssuesList: IssuesList;

jest.mock("~/api/manager", () => ({
  ...jest.requireActual("~/api/manager"),
  startInstallation: () => mockStartInstallationFn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useAllIssues: () => mockIssuesList,
}));

describe("when there are installation issues", () => {
  beforeEach(() => {
    mockIssuesList = new IssuesList(
      [
        {
          description: "Fake Issue",
          source: 0,
          severity: 0,
          details: "Fake Issue details",
        },
      ],
      [],
      [],
      [],
    );
  });

  it("renders nothing", () => {
    const { container } = installerRender(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("when there are not installation issues", () => {
  beforeEach(() => {
    mockIssuesList = new IssuesList([], [], [], []);
  });

  it("renders an Install button", () => {
    installerRender(<InstallButton />);
    screen.getByRole("button", { name: "Install" });
  });

  it("starts the installation after user clicks on it and accept the confirmation", async () => {
    const { user } = installerRender(<InstallButton />);
    const button = await screen.findByRole("button", { name: "Install" });
    await user.click(button);

    const continueButton = await screen.findByRole("button", { name: "Continue" });
    await user.click(continueButton);
    expect(mockStartInstallationFn).toHaveBeenCalled();
  });

  it("does not start the installation if the user clicks on it but cancels the confirmation", async () => {
    const { user } = installerRender(<InstallButton />);
    const button = await screen.findByRole("button", { name: "Install" });
    await user.click(button);

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(mockStartInstallationFn).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    });
  });

  describe("but installer is rendering the product selection", () => {
    beforeEach(() => {
      mockRoutes(PRODUCT_PATHS.changeProduct);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<InstallButton />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("but installer is configuring a product", () => {
    beforeEach(() => {
      mockRoutes(PRODUCT_PATHS.progress);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<InstallButton />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
