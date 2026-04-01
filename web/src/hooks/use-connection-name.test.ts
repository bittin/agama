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

import { renderHook } from "@testing-library/react";
import { useConnectionName } from "./use-connection-name";

const mockConnections = [];

jest.mock("~/hooks/model/system/network", () => ({
  useSystem: () => ({ connections: mockConnections }),
}));

describe("useConnectionName", () => {
  beforeEach(() => {
    mockConnections.length = 0;
  });

  describe("when binding mode is 'none'", () => {
    it("returns the type as the name", () => {
      const { result } = renderHook(() =>
        useConnectionName("ethernet", { mode: "none", iface: "enp1s0", mac: "AA:BB:CC:DD:EE:FF" }),
      );
      expect(result.current).toBe("ethernet");
    });
  });

  describe("when binding mode is 'iface'", () => {
    it("returns type_iface as the name", () => {
      const { result } = renderHook(() =>
        useConnectionName("ethernet", { mode: "iface", iface: "enp1s0", mac: "AA:BB:CC:DD:EE:FF" }),
      );
      expect(result.current).toBe("ethernet_enp1s0");
    });
  });

  describe("when binding mode is 'mac'", () => {
    it("returns type_mac (colons stripped) as the name", () => {
      const { result } = renderHook(() =>
        useConnectionName("ethernet", { mode: "mac", iface: "enp1s0", mac: "AA:BB:CC:DD:EE:FF" }),
      );
      expect(result.current).toBe("ethernet_AABBCCDDEEFF");
    });
  });

  describe("when the base name is already taken", () => {
    it("appends _2 as suffix", () => {
      mockConnections.push({ id: "ethernet" });
      const { result } = renderHook(() =>
        useConnectionName("ethernet", { mode: "none", iface: "", mac: "" }),
      );
      expect(result.current).toBe("ethernet_2");
    });

    it("increments the suffix until a unique name is found", () => {
      mockConnections.push({ id: "ethernet" }, { id: "ethernet_2" }, { id: "ethernet_3" });
      const { result } = renderHook(() =>
        useConnectionName("ethernet", { mode: "none", iface: "", mac: "" }),
      );
      expect(result.current).toBe("ethernet_4");
    });
  });
});
