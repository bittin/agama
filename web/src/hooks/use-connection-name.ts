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

import { title } from "radashi";
import { useSystem } from "~/hooks/model/system/network";
import { ConnectionBindingMode } from "~/types/network";

type UseConnectionNameOptions = {
  mode: ConnectionBindingMode;
  iface: string;
  mac: string;
};

/**
 * Returns a unique auto-generated connection name based on type and binding.
 *
 * The name follows the pattern `Type device (N)` where device is the interface
 * name, the MAC address (colons stripped), or nothing when binding mode is
 * "none". If the base name is already taken, a numeric suffix is appended
 * starting at 2 (e.g. `Ethernet enp1s0 2`).
 *
 * Uniqueness is checked against the current system connections.
 */
function useConnectionName(type: string, { mode, iface, mac }: UseConnectionNameOptions): string {
  const { connections } = useSystem();

  const devicePartByMode: Record<ConnectionBindingMode, string> = {
    none: "",
    iface,
    mac,
  };

  const typePart = title(type);
  const devicePart = devicePartByMode[mode];
  const baseName = devicePart ? `${typePart} ${devicePart}` : typePart;

  const existing = new Set(connections.map((c) => c.id));

  if (!existing.has(baseName)) return baseName;

  let n = 2;
  while (existing.has(`${baseName} ${n}`)) n++;
  return `${baseName} ${n}`;
}

export { useConnectionName };
