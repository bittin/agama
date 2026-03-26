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
import { useFormContext } from "~/hooks/form";
import { _, N_ } from "~/i18n";

const BINDING_MODE_OPTIONS = [
  {
    value: "none",
    label: N_("Any"),
    description: N_("The system chooses the device automatically"),
  },
  {
    value: "iface",
    label: N_("Chosen by name"),
    description: N_("Only use the device with this name"),
  },
  {
    value: "mac",
    label: N_("Chosen by MAC"),
    description: N_("Only use the device with this hardware address"),
  },
];

/** Props for {@link BindingModeSelector}. */
type BindingModeSelectorProps = {
  /** Form field name to bind to. */
  name: string;
};

/**
 * A `ChoiceField`-based selector for the connection binding mode.
 *
 * Offers three options: Unbound (any device may use the connection),
 * To device name (bind by interface name), and To MAC address (bind by
 * hardware address).
 *
 * Must be rendered inside a `useAppForm`-backed form; uses `useFormContext`
 * internally.
 */
export default function BindingModeSelector({ name }: BindingModeSelectorProps) {
  const form = useFormContext();

  return (
    <form.AppField name={name as any}>
      {(field) => (
        <field.ChoiceField
          label={_("Device")}
          options={BINDING_MODE_OPTIONS.map((o) => ({
            ...o,
            // eslint-disable-next-line agama-i18n/string-literals
            label: _(o.label),
            // eslint-disable-next-line agama-i18n/string-literals
            description: _(o.description),
          }))}
        />
      )}
    </form.AppField>
  );
}
