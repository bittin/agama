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
import { useNavigate } from "react-router";
import {
  Alert,
  ActionGroup,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Split,
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import LabelText from "~/components/form/LabelText";
import { Connection, ConnectionMethod } from "~/types/network";
import { buildAddress } from "~/utils/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { useAppForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { _, N_ } from "~/i18n";

const METHOD_OPTIONS = [
  { value: ConnectionMethod.AUTO, label: N_("Automatic (DHCP)") },
  { value: ConnectionMethod.MANUAL, label: N_("Manual") },
];

const IPV4_DEFAULT_PREFIX = 24;
const IPV6_DEFAULT_PREFIX = 64;

/** Splits a space/newline separated string into a trimmed, non-empty token array. */
const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Ensures a CIDR string has a prefix, adding a protocol-appropriate default if missing. */
const withPrefix = (address: string): string => {
  if (address.includes("/")) return address;
  return address.includes(":")
    ? `${address}/${IPV6_DEFAULT_PREFIX}`
    : `${address}/${IPV4_DEFAULT_PREFIX}`;
};

/** Parses a space/newline separated string of addresses into IPAddress objects. */
const parseAddresses = (raw: string) => parseTokens(raw).map(withPrefix).map(buildAddress);

/**
 * Form for creating a new network connection.
 *
 * @remarks
 * Server errors are surfaced via TanStack Form's `validators.onSubmitAsync`.
 * This is the recommended pattern for forms where the server acts as the
 * validator: the call lives in the async validator, which returns `{ form:
 * message }` on failure. TanStack then exposes the message via
 * `state.errorMap.onSubmit.form` without throwing, keeping the button
 * re-enabled for a retry.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/validation
 * @see https://github.com/TanStack/form/discussions/623#discussioncomment-13026699
 */
export default function ConnectionForm() {
  const navigate = useNavigate();
  const devices = useDevices();
  const { mutateAsync: updateConnection } = useConnectionMutation();

  const form = useAppForm({
    defaultValues: {
      name: "",
      interface: devices[0]?.name ?? "",
      method4: ConnectionMethod.AUTO,
      gateway4: "",
      method6: ConnectionMethod.AUTO,
      gateway6: "",
      addresses: "",
      useCustomDns: false,
      nameservers: "",
      useCustomDnsSearch: false,
      dnsSearchList: "",
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const connection = new Connection(value.name, {
          iface: value.interface,
          method4: value.method4,
          gateway4: value.gateway4,
          method6: value.method6,
          gateway6: value.gateway6,
          addresses: parseAddresses(value.addresses),
          nameservers: value.useCustomDns ? parseTokens(value.nameservers) : [],
          dnsSearchList: value.useCustomDnsSearch ? parseTokens(value.dnsSearchList) : [],
        });
        try {
          await updateConnection(connection);
        } catch (e) {
          return { form: e.message };
        }
      },
    },
    onSubmit: () => navigate(-1),
  });

  const breadcrumbs = [{ label: _("Network"), path: NETWORK.root }, { label: _("New connection") }];

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
            {(serverError) =>
              serverError && (
                <Alert variant="danger" isInline title={_("The connection could not be saved")}>
                  {serverError}
                </Alert>
              )
            }
          </form.Subscribe>

          <form.Field name="name">
            {(field) => (
              <FormGroup fieldId={field.name} label={_("Name")}>
                <TextInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(_, v) => field.handleChange(v)}
                />
              </FormGroup>
            )}
          </form.Field>

          <form.Field name="interface">
            {(field) => (
              <FormGroup fieldId={field.name} label={_("Interface")}>
                <FormSelect
                  id={field.name}
                  value={field.state.value}
                  onChange={(_, v) => field.handleChange(v)}
                >
                  {devices.map((d) => (
                    <FormSelectOption key={d.name} value={d.name} label={d.name} />
                  ))}
                </FormSelect>
              </FormGroup>
            )}
          </form.Field>

          <Split hasGutter>
            <form.Field name="method4">
              {(field) => (
                <FormGroup fieldId={field.name} label={_("IPv4 Method")}>
                  <FormSelect
                    id={field.name}
                    value={field.state.value}
                    onChange={(_, v) => field.handleChange(v as ConnectionMethod)}
                  >
                    {METHOD_OPTIONS.map(({ value, label }) => (
                      // eslint-disable-next-line agama-i18n/string-literals
                      <FormSelectOption key={value} value={value} label={_(label)} />
                    ))}
                  </FormSelect>
                </FormGroup>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.method4}>
              {(method4) =>
                method4 === ConnectionMethod.MANUAL && (
                  <form.Field name="gateway4">
                    {(field) => (
                      <FormGroup
                        fieldId={field.name}
                        label={<LabelText suffix={_("(optional)")}>{_("IPv4 Gateway")}</LabelText>}
                      >
                        <TextInput
                          id={field.name}
                          value={field.state.value}
                          onChange={(_, v) => field.handleChange(v)}
                        />
                      </FormGroup>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>
          </Split>

          <Split hasGutter>
            <form.Field name="method6">
              {(field) => (
                <FormGroup fieldId={field.name} label={_("IPv6 Method")}>
                  <FormSelect
                    id={field.name}
                    value={field.state.value}
                    onChange={(_, v) => field.handleChange(v as ConnectionMethod)}
                  >
                    {METHOD_OPTIONS.map(({ value, label }) => (
                      // eslint-disable-next-line agama-i18n/string-literals
                      <FormSelectOption key={value} value={value} label={_(label)} />
                    ))}
                  </FormSelect>
                </FormGroup>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.method6}>
              {(method6) =>
                method6 === ConnectionMethod.MANUAL && (
                  <form.Field name="gateway6">
                    {(field) => (
                      <FormGroup
                        fieldId={field.name}
                        label={<LabelText suffix={_("(optional)")}>{_("IPv6 Gateway")}</LabelText>}
                      >
                        <TextInput
                          id={field.name}
                          value={field.state.value}
                          onChange={(_, v) => field.handleChange(v)}
                        />
                      </FormGroup>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>
          </Split>

          <form.Subscribe
            selector={(s) => ({
              method4: s.values.method4,
              method6: s.values.method6,
            })}
          >
            {({ method4, method6 }) => {
              const manual4 = method4 === ConnectionMethod.MANUAL;
              const manual6 = method6 === ConnectionMethod.MANUAL;

              const addressesLabel = () => {
                if (manual4 && manual6)
                  return (
                    <LabelText suffix={_("(IPv4 and IPv6 required)")}>
                      {_("IP Addresses")}
                    </LabelText>
                  );
                if (manual4)
                  return <LabelText suffix={_("(IPv4 required)")}>{_("IP Addresses")}</LabelText>;
                if (manual6)
                  return <LabelText suffix={_("(IPv6 required)")}>{_("IP Addresses")}</LabelText>;
                return <LabelText suffix={_("(optional)")}>{_("IP Addresses")}</LabelText>;
              };
              const label = addressesLabel();

              return (
                <form.Field name="addresses">
                  {(field) => (
                    <FormGroup fieldId={field.name} label={label}>
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
                            {_("Space-separated, e.g. 192.168.1.1/24 2001:db8::1")}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>
                  )}
                </form.Field>
              );
            }}
          </form.Subscribe>

          <form.Field name="useCustomDns">
            {(dnsToggle) => (
              <>
                <Checkbox
                  id={dnsToggle.name}
                  label={_("Use custom DNS servers")}
                  isChecked={dnsToggle.state.value}
                  onChange={(_, checked) => dnsToggle.handleChange(checked)}
                />
                {dnsToggle.state.value && (
                  <NestedContent margin="mxLg">
                    <form.Field name="nameservers">
                      {(field) => (
                        <FormGroup fieldId={field.name}>
                          <TextArea
                            id={field.name}
                            value={field.state.value}
                            onChange={(_, v) => field.handleChange(v)}
                            aria-label={_("DNS servers")}
                            aria-describedby={`${field.name}-hint`}
                          />
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem variant="indeterminate" id={`${field.name}-hint`}>
                                {_("Space-separated, e.g. 8.8.8.8 2001:4860:4860::8888")}
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

          <form.Field name="useCustomDnsSearch">
            {(dnsSearchToggle) => (
              <>
                <Checkbox
                  id={dnsSearchToggle.name}
                  label={_("Use custom DNS search domains")}
                  isChecked={dnsSearchToggle.state.value}
                  onChange={(_, checked) => dnsSearchToggle.handleChange(checked)}
                />
                {dnsSearchToggle.state.value && (
                  <NestedContent margin="mxLg">
                    <form.Field name="dnsSearchList">
                      {(field) => (
                        <FormGroup fieldId={field.name}>
                          <TextArea
                            id={field.name}
                            value={field.state.value}
                            onChange={(_, v) => field.handleChange(v)}
                            aria-label={_("DNS search domains")}
                            aria-describedby={`${field.name}-hint`}
                          />
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem variant="indeterminate" id={`${field.name}-hint`}>
                                {_("Space-separated, e.g. example.com local.lan")}
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

          <ActionGroup>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" isLoading={isSubmitting} isDisabled={isSubmitting}>
                  {_("Accept")}
                </Button>
              )}
            </form.Subscribe>
            <Button variant="link" onClick={() => navigate(-1)}>
              {_("Cancel")}
            </Button>
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
