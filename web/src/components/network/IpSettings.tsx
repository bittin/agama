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
import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import LabelText from "~/components/form/LabelText";
import { useFormContext } from "~/hooks/form";
import { _, N_ } from "~/i18n";

/** Field names used by {@link IpSettings} to bind to the parent form. */
type FieldNames = {
  mode: string;
  addresses: string;
  gateway: string;
};

/** Props for {@link IpSettings}. */
type IpSettingsProps = {
  protocol: "ipv4" | "ipv6";
  fieldNames: FieldNames;
};

/**
 * Builds the mode options for the given protocol.
 *
 * - `default`: no method or addresses sent; the network manages everything.
 * - `auto`: method set to auto; no extra fields shown. Uses DHCP for IPv4,
 *   SLAAC or DHCPv6 for IPv6 depending on what the network provides.
 * - `manual`: method set to manual, with required addresses and optional gateway.
 * - `mixed`: method set to auto with optional static addresses and gateway,
 *   for the uncommon case of combining automatic and manual addressing.
 *
 * Labels and descriptions use `N_()` for extraction and `_()` at render time.
 */
const modeOptions = (protocol: "ipv4" | "ipv6") => [
  {
    value: "default",
    label: N_("Default"),
    description: N_("No IP settings; relies on the network."),
  },
  {
    value: "auto",
    label: N_("Automatic"),
    description:
      protocol === "ipv4" ? N_("Requests an address via DHCP.") : N_("Uses SLAAC or DHCPv6."),
  },
  {
    value: "manual",
    label: N_("Manual"),
    description: N_("Set your own network configuration."),
  },
  {
    value: "mixed",
    label: N_("Mixed"),
    description: N_("Combines Automatic and Manual. Not needed for most setups."),
  },
];

/**
 * Protocol-specific IP settings block for a connection form.
 *
 * Shows a mode selector with four options: Default, Automatic, Manual, and
 * Mixed. Each option has a short description. The Automatic description is
 * protocol-aware: DHCP for IPv4, SLAAC or DHCPv6 for IPv6.
 *
 * Selecting Manual or Mixed reveals an addresses textarea and a gateway field.
 * Addresses are labeled as optional in Mixed mode. The gateway label notes
 * when it will be ignored (Mixed mode with no addresses).
 *
 * Must be rendered inside a `useAppForm`-backed form; uses `useFormContext`
 * internally. Field names must be provided explicitly via `fieldNames`.
 *
 * @remarks
 * Field labels are prefixed with the protocol name (e.g. "IPv4 Gateway"
 * instead of "Gateway") because both protocols can be visible at the same
 * time. Without the prefix, a screen reader navigating between controls loses
 * the context that sighted users get from the visual grouping. Prefixing makes
 * each label self-sufficient for both audiences, as recommended by WCAG 2.4.6.
 * @see https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html
 */
export default function IpSettings({ protocol, fieldNames }: IpSettingsProps) {
  const form = useFormContext();
  const isIPv4 = protocol === "ipv4";
  const label = isIPv4 ? _("IPv4 Settings") : _("IPv6 Settings");
  const addressesLabel = isIPv4 ? _("IPv4 Addresses") : _("IPv6 Addresses");
  const gatewayLabel = isIPv4 ? _("IPv4 Gateway") : _("IPv6 Gateway");
  const addressesHint = isIPv4
    ? _("Space-separated IPv4 addresses with optional prefix, e.g. 192.168.1.1 or 192.168.1.1/24")
    : _("Space-separated IPv6 addresses with optional prefix, e.g. 2001:db8::1 or 2001:db8::1/64");

  return (
    <>
      <form.AppField name={fieldNames.mode as any}>
        {(field) => (
          <field.ChoiceField
            label={label}
            options={modeOptions(protocol).map((o) => ({
              ...o,
              // eslint-disable-next-line agama-i18n/string-literals
              label: _(o.label),
              // eslint-disable-next-line agama-i18n/string-literals
              description: _(o.description),
            }))}
          />
        )}
      </form.AppField>

      <form.Subscribe selector={(s) => (s.values as any)[fieldNames.mode]}>
        {(mode) =>
          (mode === "manual" || mode === "mixed") && (
            <NestedContent margin="mxLg">
              <form.Field name={fieldNames.addresses as any}>
                {(field) => (
                  <FormGroup
                    fieldId={field.name}
                    label={
                      mode === "mixed" ? (
                        <LabelText suffix={_("(optional)")}>{addressesLabel}</LabelText>
                      ) : (
                        addressesLabel
                      )
                    }
                  >
                    <TextArea
                      id={field.name}
                      value={field.state.value}
                      onChange={(_, v) => field.handleChange(v)}
                      resizeOrientation="vertical"
                      aria-describedby={`${field.name}-hint`}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="indeterminate" id={`${field.name}-hint`}>
                          {addressesHint}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                )}
              </form.Field>

              <form.Field name={fieldNames.gateway as any}>
                {(field) => (
                  <FormGroup
                    fieldId={field.name}
                    label={
                      <LabelText
                        suffix={
                          mode === "mixed"
                            ? _("(optional, ignored if no addresses provided)")
                            : _("(optional)")
                        }
                      >
                        {gatewayLabel}
                      </LabelText>
                    }
                  >
                    <TextInput
                      id={field.name}
                      value={field.state.value}
                      onChange={(_, v) => field.handleChange(v)}
                    />
                  </FormGroup>
                )}
              </form.Field>
            </NestedContent>
          )
        }
      </form.Subscribe>
    </>
  );
}
