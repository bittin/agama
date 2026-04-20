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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import testingPatterns from "./patterns.test.json";
import testingProposal from "./proposal.test.json";
import SoftwarePage from "./SoftwarePage";

const mockProposal = jest.fn();

jest.mock("~/components/layout/Header", () => () => <div>Header Mock</div>);
jest.mock("~/components/questions/Questions", () => () => <div>Questions Mock</div>);

jest.mock("~/hooks/model/issue", () => ({
  useIssues: () => [],
}));

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => mockProposal(),
}));

jest.mock("~/hooks/model/system/software", () => ({
  useSystem: () => ({ patterns: testingPatterns }),
}));

describe("SoftwarePage", () => {
  beforeEach(() => {
    mockProposal.mockReturnValue(testingProposal);
  });

  it("renders selected desktop", () => {
    installerRender(<SoftwarePage />);
    screen.getByText("Desktop");
    screen.getByText("GNOME Desktop Environment (Wayland)");
    expect(screen.queryByText("KDE Applications and Plasma 5 Desktop")).toBeNull();
    expect(screen.queryByText("XFCE Desktop Environment")).toBeNull();
  });

  it("renders a list of selected patterns", () => {
    installerRender(<SoftwarePage />);
    screen.getByText("Patterns");
    screen.getByText("YaST Base Utilities");
    screen.getByText("YaST Desktop Utilities");
    screen.getByText("Multimedia");
    screen.getByText("Office Software");
    expect(screen.queryByText("YaST Server Utilities")).toBeNull();
  });

  it("renders the summary", () => {
    installerRender(<SoftwarePage />);
    screen.getByText(
      /About 4.60 GiB space needed with the current selection \(4 patterns and 1 desktops\)/,
    );
  });

  it("renders buttons for navigating to patterns selection", () => {
    installerRender(<SoftwarePage />);
    screen.getByRole("link", { name: "Change patterns" });
    screen.getByRole("link", { name: "Change desktop" });
  });

  it("shows auto selected label for automatically selected patterns", () => {
    installerRender(<SoftwarePage />);
    const yasTBaseUtilities = screen.getByText("YaST Base Utilities").closest("li");
    const yasTDesktopUtilities = screen.getByText("YaST Desktop Utilities").closest("li");
    const officeSoftware = screen.getByText("Office Software").closest("li");
    const multimedia = screen.getByText("Multimedia").closest("li");

    expect(yasTBaseUtilities).toHaveTextContent("auto selected");
    expect(yasTDesktopUtilities).toHaveTextContent("auto selected");
    expect(officeSoftware).toHaveTextContent("auto selected");
    expect(multimedia).toHaveTextContent("auto selected");
  });

  it("does not show auto selected label for user-selected patterns", () => {
    installerRender(<SoftwarePage />);
    const gnomeDesktop = screen.getByText("GNOME Desktop Environment (Wayland)").closest("li");
    expect(gnomeDesktop).not.toHaveTextContent("auto selected");
  });

  it("does not render patterns marked as removed", () => {
    const proposalWithRemovedPattern = {
      ...testingProposal,
      patterns: {
        ...testingProposal.patterns,
        multimedia: "removed",
      },
    };
    mockProposal.mockReturnValue(proposalWithRemovedPattern);

    installerRender(<SoftwarePage />);
    expect(screen.queryByText("Multimedia")).toBeNull();
  });

  describe("when there is no proposal yet", () => {
    beforeEach(() => {
      mockProposal.mockReturnValue(null);
    });

    it("renders an informative messsage", () => {
      installerRender(<SoftwarePage />);
      screen.getByText("No information available yet");
    });
  });
});
