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
import Text from "~/components/core/Text";
import HiddenLabel from "~/components/form/HiddenLabel";
import { useFormContext } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { _ } from "~/i18n";

/** Props for {@link DeviceSelector}. */
type DeviceSelectorProps = {
  /** Form field name to bind to. */
  name: string;
  /**
   * Whether to select by interface name or by MAC address.
   *
   * Determines which device property is used as the option value and label,
   * with the other shown as the option description for context.
   */
  by: "iface" | "mac";
};

/**
 * A `ChoiceField`-based selector for picking a network device, either by
 * interface name or by MAC address. Each option shows the primary identifier
 * as the label and the secondary one as the description.
 *
 * Must be rendered inside a `useAppForm`-backed form; uses `useFormContext`
 * internally. The field name must be provided explicitly via `name`.
 */
export default function DeviceSelector({ name, by }: DeviceSelectorProps) {
  const form = useFormContext();
  const devices = useDevices();

  const label = by === "iface" ? _("Device name") : _("MAC address");
  const descriptionPrefix = by === "iface" ? _("MAC:") : _("Name:");
  const options = devices.map((d) => {
    const value = by === "iface" ? d.name : d.macAddress;
    return {
      value,
      label: value,
      description: (
        <Text textStyle={["textColorSubtle", "fontSizeXs"]}>
          <Text isBold>{descriptionPrefix}</Text> {by === "iface" ? d.macAddress : d.name}
        </Text>
      ),
    };
  });

  return (
    <form.AppField name={name as any}>
      {(field) => <field.ChoiceField label={<HiddenLabel>{label}</HiddenLabel>} options={options} />}
    </form.AppField>
  );
}
