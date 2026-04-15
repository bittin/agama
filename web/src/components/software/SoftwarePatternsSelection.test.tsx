/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { patchConfig } from "~/api";
import testingPatterns from "./patterns.test.json";
import testingProposal from "./proposal.test.json";
import SoftwarePatternsSelection from "./SoftwarePatternsSelection";

const patternsWithPreselected = [
  ...testingPatterns,
  {
    name: "preselected_pattern",
    category: "Base Technologies",
    icon: "./pattern-base",
    description: "A pattern preselected by the product",
    summary: "Preselected Pattern",
    order: "1225",
    preselected: true,
  },
];

jest.mock("~/hooks/model/system/software", () => ({
  useSystem: () => ({ patterns: patternsWithPreselected }),
}));

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => ({
    patterns: {
      ...testingProposal.patterns,
      preselected_pattern: "auto",
      kde: "removed",
    },
  }),
}));

jest.mock("~/api", () => ({
  patchConfig: jest.fn(),
}));

describe("SoftwarePatternsSelection", () => {
  it("displays the pattern in the correct order", async () => {
    installerRender(<SoftwarePatternsSelection />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual([
      "Patterns",
      "Graphical Environments",
      "Base Technologies",
      "Desktop Functions",
    ]);

    // the "Base Technologies" pattern group
    const baseGroup = await screen.findByRole("list", { name: "Base Technologies" });
    // the "Base Technologies" pattern items
    const items = within(baseGroup).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/YaST Base Utilities/);
    expect(items[1]).toHaveTextContent(/YaST Desktop Utilities/);
    expect(items[2]).toHaveTextContent(/YaST Server Utilities/);
  });

  it("displays only the matching patterns when filtering", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);

    // enter "multimedia" into the search filter
    const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
    await user.type(searchFilter, "multimedia");

    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText).toEqual(["Patterns", "Desktop Functions"]);

    const desktopGroup = screen.getByRole("list", { name: "Desktop Functions" });
    expect(within(desktopGroup).queryByText(/Multimedia$/)).toBeInTheDocument();
    expect(within(desktopGroup).queryByText(/Office Software/)).not.toBeInTheDocument();
  });

  it("displays the checkbox reflecting the current pattern selection status", async () => {
    installerRender(<SoftwarePatternsSelection />);

    // the "Base Technologies" pattern group
    const baseGroup = await screen.findByRole("list", { name: "Base Technologies" });

    const basisCheckbox = await within(baseGroup).findByRole("checkbox", {
      name: /Unselect YaST Base/,
    });
    expect(basisCheckbox).toBeChecked();

    const serverCheckbox = await within(baseGroup).findByRole("checkbox", {
      name: /Select YaST Server/,
    });
    expect(serverCheckbox).not.toBeChecked();
  });

  describe("when submitting the form", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("removes patterns that were initially selected (AUTO) and are now unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

      const basisCheckbox = await screen.findByRole("checkbox", {
        name: `Unselect ${y2BasisPattern.summary}`,
      });
      expect(basisCheckbox).toBeChecked();

      await user.click(basisCheckbox);
      expect(basisCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["yast2_basis"]),
            remove: expect.arrayContaining(["yast2_basis"]),
          },
        },
      });
    });

    it("removes patterns that were initially selected (USER) and are now unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const gnomePattern = testingPatterns.find((p) => p.name === "gnome");

      const gnomeCheckbox = await screen.findByRole("checkbox", {
        name: `Unselect ${gnomePattern.summary}`,
      });
      expect(gnomeCheckbox).toBeChecked();

      await user.click(gnomeCheckbox);
      expect(gnomeCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["gnome"]),
            remove: expect.arrayContaining(["gnome"]),
          },
        },
      });
    });

    it("adds newly selected patterns", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const kdePattern = testingPatterns.find((p) => p.name === "kde");

      const kdeCheckbox = await screen.findByRole("checkbox", {
        name: `Select ${kdePattern.summary}`,
      });
      expect(kdeCheckbox).not.toBeChecked();

      await user.click(kdeCheckbox);
      expect(kdeCheckbox).toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.arrayContaining(["kde"]),
            remove: expect.not.arrayContaining(["kde"]),
          },
        },
      });
    });

    it("only adds USER-selected patterns when form is pristine", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            // Only USER-selected patterns (not AUTO)
            add: ["gnome"],
            // AUTO patterns stay AUTO (not converted to USER)
            remove: expect.arrayContaining(["kde"]),
          },
        },
      });
    });

    it("does not include unselected patterns that remain unselected", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["kde", "xfce", "yast2_server"]),
            remove: expect.not.arrayContaining(["kde", "xfce", "yast2_server"]),
          },
        },
      });
    });

    it("removes preselected patterns when unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const preselectedCheckbox = await screen.findByRole("checkbox", {
        name: /Preselected Pattern/,
      });
      expect(preselectedCheckbox).toBeChecked();

      await user.click(preselectedCheckbox);
      expect(preselectedCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["preselected_pattern"]),
            remove: expect.arrayContaining(["preselected_pattern"]),
          },
        },
      });
    });

    it("keeps REMOVED patterns in remove list when they remain unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.any(Array),
            remove: expect.arrayContaining(["kde"]),
          },
        },
      });
    });

    it("adds AUTO-selected patterns when user touches them (uncheck/recheck)", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

      const basisCheckbox = await screen.findByRole("checkbox", {
        name: `Unselect ${y2BasisPattern.summary}`,
      });
      expect(basisCheckbox).toBeChecked();

      // Uncheck then recheck (makes it dirty)
      await user.click(basisCheckbox);
      expect(basisCheckbox).not.toBeChecked();
      await user.click(basisCheckbox);
      expect(basisCheckbox).toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            // Now yast2_basis is added because user touched it (dirty)
            add: expect.arrayContaining(["gnome", "yast2_basis"]),
            remove: expect.arrayContaining(["kde"]),
          },
        },
      });
    });
  });
});
