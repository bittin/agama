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
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import { withForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { _ } from "~/i18n";

/**
 * A `ChoiceField` based selector for picking a network device, either by
 * interface name or by MAC address.
 *
 * Receives a typed form instance via `withForm`.
 */
const DeviceSelector = withForm({
  ...connectionFormOptions,
  props: {
    by: "iface" as "iface" | "mac",
  },
  render: function Render({ form, by }) {
    const devices = useDevices();
    const valueKey = by === "iface" ? "name" : "macAddress";

    const name = by === "iface" ? "iface" : "ifaceMac";
    const label = by === "iface" ? _("Device name") : _("MAC address");
    const options = devices.map((d) => {
      const value = d[valueKey];
      return {
        value,
        label: value,
        description: (
          <Text textStyle={["textColorSubtle", "fontSizeXs"]}>
            {by === "iface" ? d.macAddress : d.name}
          </Text>
        ),
      };
    });

    const listeners = {
      // Pre-select the first available device when the selector mounts with no
      // value, e.g. when the user switches from "Any device" binding mode.
      onMount: ({ value }: { value: string }) => {
        if (!value && devices.length > 0)
          form.setFieldValue(name, devices[0][valueKey], { dontUpdateMeta: true });
      },
    };

    return (
      <form.AppField name={name} listeners={listeners}>
        {(field) => <field.ChoiceField label={<Text srOnly>{label}</Text>} options={options} />}
      </form.AppField>
    );
  },
});

export default DeviceSelector;
