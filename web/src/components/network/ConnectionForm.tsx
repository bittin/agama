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
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import IpSettings from "~/components/network/IpSettings";
import BindingModeSelector from "~/components/network/BindingModeSelector";
import DeviceSelector from "~/components/network/DeviceSelector";
import { Connection, ConnectionBindingMode, ConnectionMethod } from "~/types/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { formOptions } from "@tanstack/react-form";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { buildAddress } from "~/utils/network";
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
 * Shared form options for ConnectionForm and its `withForm` based
 * sub-components
 *
 * Sub-components spread these options in their `withForm` definition so
 * TanStack Form can infer the field types, enabling type-safe props.
 */
export const connectionFormOptions = formOptions({
  defaultValues: {
    name: "",
    iface: "",
    ifaceMac: "",
    ipv4Mode: "unset",
    addresses4: "",
    gateway4: "",
    ipv6Mode: "unset",
    addresses6: "",
    gateway6: "",
    nameservers: "",
    dnsSearchList: "",
    useCustomDns: false,
    useCustomDnsSearch: false,
    bindingMode: "none" as ConnectionBindingMode,
  },
});

/**
 * Maps form mode values to their corresponding {@link ConnectionMethod}.
 *
 * "unset" is intentionally absent: omitting it causes the Connection
 * constructor to write no method, delegating the decision to NetworkManager.
 * This map can be dropped once the form mode values align with
 * {@link ConnectionMethod} enum values.
 */
const MODE_TO_METHOD: Record<string, ConnectionMethod> = {
  auto: ConnectionMethod.AUTO,
  manual: ConnectionMethod.MANUAL,
};

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
    ...mergeFormDefaults(connectionFormOptions, {
      iface: devices[0]?.name ?? "",
      ifaceMac: devices[0]?.macAddress ?? "",
    }),
    validators: {
      onSubmitAsync: async ({ value }) => {
        const ipv4Addresses =
          value.ipv4Mode === "manual" || value.ipv4Mode === "auto"
            ? parseAddresses(value.addresses4)
            : [];
        const ipv6Addresses =
          value.ipv6Mode === "manual" || value.ipv6Mode === "auto"
            ? parseAddresses(value.addresses6)
            : [];

        const connection = new Connection(value.name, {
          iface: value.bindingMode === "iface" ? value.iface : "",
          macAddress: value.bindingMode === "mac" ? value.ifaceMac : "",
          method4: MODE_TO_METHOD[value.ipv4Mode],
          gateway4: ipv4Addresses.length > 0 ? value.gateway4 : "",
          method6: MODE_TO_METHOD[value.ipv6Mode],
          gateway6: ipv6Addresses.length > 0 ? value.gateway6 : "",
          addresses: [...ipv4Addresses, ...ipv6Addresses],
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

            <Flex alignItems={{ default: "alignItemsFlexEnd" }} gap={{ default: "gapMd" }}>
              <BindingModeSelector form={form} />

              <form.Subscribe selector={(s) => s.values.bindingMode}>
                {(mode) => mode !== "none" && <DeviceSelector form={form} by={mode} />}
              </form.Subscribe>
            </Flex>

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

            <IpSettings form={form} protocol="ipv4" />

            <IpSettings form={form} protocol="ipv6" />

            <form.Field name="useCustomDns">
              {(dnsToggle) => (
                <>
                  <Checkbox
                    id={dnsToggle.name}
                    label={_("Use custom DNS")}
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
                                  {_("Space-separated list of DNS server addresses")}
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
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
