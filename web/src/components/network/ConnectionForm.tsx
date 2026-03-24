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
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import IpSettings from "~/components/network/IpSettings";
import { Connection, ConnectionMethod } from "~/types/network";
import { buildAddress } from "~/utils/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { useAppForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

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
      ipv4Mode: "default",
      method4: ConnectionMethod.AUTO,
      addresses4: "",
      gateway4: "",
      nameservers4: "",
      useExtra4: false,
      ipv6Mode: "default",
      method6: ConnectionMethod.AUTO,
      addresses6: "",
      gateway6: "",
      nameservers6: "",
      useExtra6: false,
      useCustomDnsSearch: false,
      dnsSearchList: "",
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const ipv4Custom = value.ipv4Mode === "custom";
        const ipv6Custom = value.ipv6Mode === "custom";
        const ipv4Manual = ipv4Custom && value.method4 === ConnectionMethod.MANUAL;
        const ipv6Manual = ipv6Custom && value.method6 === ConnectionMethod.MANUAL;
        const ipv4WithExtra = ipv4Custom && value.method4 === ConnectionMethod.AUTO && value.useExtra4;
        const ipv6WithExtra = ipv6Custom && value.method6 === ConnectionMethod.AUTO && value.useExtra6;

        const addresses = [
          ...(ipv4Manual || ipv4WithExtra ? parseAddresses(value.addresses4) : []),
          ...(ipv6Manual || ipv6WithExtra ? parseAddresses(value.addresses6) : []),
        ];

        const nameservers = [
          ...(ipv4Manual || ipv4WithExtra ? parseTokens(value.nameservers4) : []),
          ...(ipv6Manual || ipv6WithExtra ? parseTokens(value.nameservers6) : []),
        ];

        const connection = new Connection(value.name, {
          iface: value.interface,
          method4: ipv4Custom ? value.method4 : ConnectionMethod.AUTO,
          gateway4: ipv4Manual ? value.gateway4 : "",
          method6: ipv6Custom ? value.method6 : ConnectionMethod.AUTO,
          gateway6: ipv6Manual ? value.gateway6 : "",
          addresses,
          nameservers,
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
        <form.AppForm>
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

            <IpSettings
              protocol="ipv4"
              fieldNames={{
                mode: "ipv4Mode",
                method: "method4",
                addresses: "addresses4",
                gateway: "gateway4",
                nameservers: "nameservers4",
                useExtra: "useExtra4",
              }}
            />

            <IpSettings
              protocol="ipv6"
              fieldNames={{
                mode: "ipv6Mode",
                method: "method6",
                addresses: "addresses6",
                gateway: "gateway6",
                nameservers: "nameservers6",
                useExtra: "useExtra6",
              }}
            />

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
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
