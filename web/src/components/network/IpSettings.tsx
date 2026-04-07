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
import NestedContent from "~/components/core/NestedContent";
import LabelText from "~/components/form/LabelText";
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import { withForm } from "~/hooks/form";
import { isValidIPv4Address, isValidIPv6Address } from "~/utils/network";
import { _, N_ } from "~/i18n";

/**
 * Mode options shared by both IPv4 and IPv6 settings.
 *
 * - `unset`: no method written to the profile; the network handles IP
 *   configuration automatically. Labeled "Automatic" to avoid exposing
 *   the underlying "no method set" detail to users.
 * - `manual`: method set to manual, with required addresses and optional gateway.
 * - `auto`: method set to auto with optional static addresses and gateway,
 *   for the uncommon case of combining automatic and manual addressing.
 *   Labeled "Advanced".
 *
 * Labels and descriptions use `N_()` for extraction and `_()` at render time.
 */
const modeOptions = () => [
  {
    value: "unset",
    label: N_("Automatic"),
    description: N_("Address and gateway from the network"),
  },
  {
    value: "manual",
    label: N_("Manual"),
    description: N_("Fixed addresses with optional gateway"),
  },
  {
    value: "auto",
    label: N_("Advanced"),
    description: N_("Automatic plus optional addresses and gateway"),
  },
];

type IpSettingsProps = {
  protocol: "ipv4" | "ipv6";
};

/**
 * Protocol-specific IP settings block for a connection form.
 *
 * Shows a selector with three options: Automatic, Manual, and Advanced.
 *
 * Receives a typed form instance via `withForm`.
 *
 * @remarks
 * Field labels are prefixed with the protocol name (e.g. "IPv4 Gateway"
 * instead of "Gateway") because both protocols can be visible at the same
 * time. Without the prefix, a screen reader navigating between controls loses
 * the context that sighted users get from the visual grouping. Prefixing makes
 * each label self-sufficient for both audiences, as recommended by WCAG 2.4.6.
 * @see https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html
 */
const IpSettings = withForm({
  ...connectionFormOptions,
  props: {
    protocol: "ipv4",
  } as IpSettingsProps,
  render: function Render({ form, protocol }) {
    const isIPv4 = protocol === "ipv4";
    const label = isIPv4 ? _("IPv4 Settings") : _("IPv6 Settings");
    const addressesLabel = isIPv4 ? _("IPv4 Addresses") : _("IPv6 Addresses");
    const gatewayLabel = isIPv4 ? _("IPv4 Gateway") : _("IPv6 Gateway");
    const modeField = isIPv4 ? "ipv4Mode" : "ipv6Mode";
    const addressesField = isIPv4 ? "addresses4" : "addresses6";
    const gatewayField = isIPv4 ? "gateway4" : "gateway6";

    return (
      <>
        <form.AppField name={modeField}>
          {(field) => (
            <field.DropdownField
              label={label}
              options={modeOptions().map(({ value, label, description }) => ({
                value,
                // eslint-disable-next-line agama-i18n/string-literals
                label: _(label),
                // eslint-disable-next-line agama-i18n/string-literals
                description: _(description),
              }))}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values[modeField]}>
          {(mode) =>
            (mode === "manual" || mode === "auto") && (
              <NestedContent margin="mxLg">
                <form.AppField name={addressesField}>
                  {(field) => (
                    <field.ArrayField
                      label={
                        mode === "auto" ? (
                          <LabelText suffix={_("(optional)")}>{addressesLabel}</LabelText>
                        ) : (
                          addressesLabel
                        )
                      }
                      inputAriaLabel={
                        mode === "auto" ? `${addressesLabel} ${_("(optional)")}` : addressesLabel
                      }
                      skipDuplicates
                      validateOnSubmit={(v) =>
                        (isIPv4 ? isValidIPv4Address(v) : isValidIPv6Address(v))
                          ? undefined
                          : isIPv4
                            ? _("Invalid IPv4 address")
                            : _("Invalid IPv6 address")
                      }
                    />
                  )}
                </form.AppField>

                <form.AppField name={gatewayField}>
                  {(field) => (
                    <field.TextField
                      label={
                        <LabelText
                          suffix={
                            mode === "auto"
                              ? _("(optional, ignored if no addresses provided)")
                              : _("(optional)")
                          }
                        >
                          {gatewayLabel}
                        </LabelText>
                      }
                    />
                  )}
                </form.AppField>
              </NestedContent>
            )
          }
        </form.Subscribe>
      </>
    );
  },
});

export default IpSettings;
