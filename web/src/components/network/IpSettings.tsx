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
  Checkbox,
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
import { ConnectionMethod } from "~/types/network";
import { _, N_ } from "~/i18n";

/** Field names used by {@link IpSettings} to bind to the parent form. */
type FieldNames = {
  mode: string;
  method: string;
  addresses: string;
  gateway: string;
  nameservers: string;
  useExtra: string;
};

/** Props for {@link IpSettings}. */
type IpSettingsProps = {
  protocol: "ipv4" | "ipv6";
  fieldNames: FieldNames;
};

/**
 * Mode options for the top-level protocol selector.
 *
 * Values use `N_()` for extraction. Translate with `_()` at render time.
 */
const MODE_OPTIONS = [
  { value: "default", label: N_("Default") },
  { value: "custom", label: N_("Custom") },
];

/**
 * Method options for the IP configuration method selector.
 *
 * Values use `N_()` for extraction. Translate with `_()` at render time.
 */
const METHOD_OPTIONS = [
  { value: ConnectionMethod.AUTO, label: N_("Automatic (DHCP)") },
  { value: ConnectionMethod.MANUAL, label: N_("Manual") },
];

/**
 * Protocol-specific IP settings block for a connection form.
 *
 * Renders a mode selector (Default / Custom). When Custom is chosen, a method
 * selector appears. Manual mode reveals required IP Addresses and optional
 * Gateway and DNS fields. Automatic mode offers an opt-in checkbox to add
 * extra static settings on top of DHCP.
 *
 * Uses `useFormContext` to access the parent form, so it must be rendered
 * inside a `useAppForm`-backed form. All field names must be provided
 * explicitly via `fieldNames`.
 */
export default function IpSettings({ protocol, fieldNames }: IpSettingsProps) {
  const form = useFormContext();
  const label = protocol === "ipv4" ? _("IPv4 Settings") : _("IPv6 Settings");
  const addressesHint =
    protocol === "ipv4"
      ? _("Space-separated IPv4 addresses with optional prefix, e.g. 192.168.1.1 or 192.168.1.1/24")
      : _(
          "Space-separated IPv6 addresses with optional prefix, e.g. 2001:db8::1 or 2001:db8::1/64",
        );
  const nameserversHint =
    protocol === "ipv4"
      ? _("Space-separated IPv4 addresses, e.g. 8.8.8.8")
      : _("Space-separated IPv6 addresses, e.g. 2001:4860:4860::8888");

  return (
    <>
      <form.AppField name={fieldNames.mode as any}>
        {(field) => (
          <field.ChoiceField
            label={label}
            // eslint-disable-next-line agama-i18n/string-literals
            options={MODE_OPTIONS.map((o) => ({ ...o, label: _(o.label) }))}
          />
        )}
      </form.AppField>

      <form.Subscribe selector={(s) => (s.values as any)[fieldNames.mode]}>
        {(mode) =>
          mode === "custom" && (
            <>
              <form.AppField name={fieldNames.method as any}>
                {(field) => (
                  <field.ChoiceField
                    label={_("Method")}
                    // eslint-disable-next-line agama-i18n/string-literals
                    options={METHOD_OPTIONS.map((o) => ({ ...o, label: _(o.label) }))}
                  />
                )}
              </form.AppField>

              <form.Subscribe selector={(s) => (s.values as any)[fieldNames.method]}>
                {(method) => (
                  <>
                    {method === ConnectionMethod.MANUAL && (
                      <>
                        <form.Field name={fieldNames.addresses as any}>
                          {(field) => (
                            <FormGroup fieldId={field.name} label={_("IP Addresses")}>
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
                              label={<LabelText suffix={_("(optional)")}>{_("Gateway")}</LabelText>}
                            >
                              <TextInput
                                id={field.name}
                                value={field.state.value}
                                onChange={(_, v) => field.handleChange(v)}
                              />
                            </FormGroup>
                          )}
                        </form.Field>

                        <form.Field name={fieldNames.nameservers as any}>
                          {(field) => (
                            <FormGroup
                              fieldId={field.name}
                              label={
                                <LabelText suffix={_("(optional)")}>{_("DNS servers")}</LabelText>
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
                                    {nameserversHint}
                                  </HelperTextItem>
                                </HelperText>
                              </FormHelperText>
                            </FormGroup>
                          )}
                        </form.Field>
                      </>
                    )}

                    {method === ConnectionMethod.AUTO && (
                      <form.Field name={fieldNames.useExtra as any}>
                        {(toggle) => (
                          <>
                            <Checkbox
                              id={toggle.name}
                              label={_("Add extra network settings")}
                              isChecked={toggle.state.value}
                              onChange={(_, checked) => toggle.handleChange(checked)}
                            />
                            {toggle.state.value && (
                              <NestedContent margin="mxLg">
                                <form.Field name={fieldNames.addresses as any}>
                                  {(field) => (
                                    <FormGroup
                                      fieldId={field.name}
                                      label={
                                        <LabelText suffix={_("(optional)")}>
                                          {_("IP Addresses")}
                                        </LabelText>
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
                                          <HelperTextItem
                                            variant="indeterminate"
                                            id={`${field.name}-hint`}
                                          >
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
                                        <LabelText suffix={_("(optional)")}>
                                          {_("Gateway")}
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

                                <form.Field name={fieldNames.nameservers as any}>
                                  {(field) => (
                                    <FormGroup
                                      fieldId={field.name}
                                      label={
                                        <LabelText suffix={_("(optional)")}>
                                          {_("DNS servers")}
                                        </LabelText>
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
                                          <HelperTextItem
                                            variant="indeterminate"
                                            id={`${field.name}-hint`}
                                          >
                                            {_(
                                              "Space-separated, e.g. 8.8.8.8 2001:4860:4860::8888",
                                            )}
                                          </HelperTextItem>
                                        </HelperText>
                                      </FormHelperText>
                                    </FormGroup>
                                  )}
                                </form.Field>
                              </NestedContent>
                            )}
                          </>
                        )}
                      </form.Field>
                    )}
                  </>
                )}
              </form.Subscribe>
            </>
          )
        }
      </form.Subscribe>
    </>
  );
}
