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
import { formOptions } from "@tanstack/react-form";
import { useNavigate, useParams } from "react-router";
import { isEmpty, shake } from "radashi";
import {
  Alert,
  ActionGroup,
  Button,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
} from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import IpSettings from "~/components/network/IpSettings";
import BindingModeSelector from "~/components/network/BindingModeSelector";
import DeviceSelector from "~/components/network/DeviceSelector";
import { Connection, ConnectionBindingMode, ConnectionMethod } from "~/types/network";
import { useConnectionMutation, useConfig } from "~/hooks/model/config/network";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useSystem, useDevices } from "~/hooks/model/system/network";
import { extendCollection } from "~/utils";
import { NETWORK } from "~/routes/paths";
import {
  buildAddress,
  connectionBindingMode,
  formatIp,
  isValidIPv4,
  isValidIPv6,
  isValidIPv4Address,
  isValidIPv6Address,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import { _ } from "~/i18n";

const IPV4_DEFAULT_PREFIX = 24;
const IPV6_DEFAULT_PREFIX = 64;

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
    addresses4: [] as string[],
    gateway4: "",
    ipv6Mode: "unset",
    addresses6: [] as string[],
    gateway6: "",
    nameservers: [] as string[],
    dnsSearchList: [] as string[],
    customDns: false,
    customDnsSearch: false,
    bindingMode: "none" as ConnectionBindingMode,
  },
});

type FormValues = typeof connectionFormOptions.defaultValues;
type FormFieldErrors = Partial<Record<keyof FormValues, string>>;

/**
 * Derives the form mode string from a stored {@link ConnectionMethod}.
 *
 * `undefined` means the connection profile has no explicit method set, which
 * corresponds to the "Automatic" (unset) option. An explicit {@link ConnectionMethod.AUTO}
 * corresponds to "Advanced" (DHCP forced), and {@link ConnectionMethod.MANUAL} to "Manual".
 */
function ipModeFromMethod(method: ConnectionMethod | undefined): string {
  if (method === ConnectionMethod.MANUAL) return "manual";
  if (method === ConnectionMethod.AUTO) return "auto";
  return "unset";
}

/**
 * Maps an existing {@link Connection} to initial form values for editing.
 */
function connectionToFormValues(connection: Connection): Partial<FormValues> {
  const addresses4 = connection.addresses.filter((a) => !a.address.includes(":")).map(formatIp);
  const addresses6 = connection.addresses.filter((a) => a.address.includes(":")).map(formatIp);

  return {
    name: connection.id,
    iface: connection.iface ?? "",
    ifaceMac: connection.macAddress ?? "",
    bindingMode: connectionBindingMode(connection),
    ipv4Mode: ipModeFromMethod(connection.method4),
    addresses4,
    gateway4: connection.gateway4 ?? "",
    ipv6Mode: ipModeFromMethod(connection.method6),
    addresses6,
    gateway6: connection.gateway6 ?? "",
    nameservers: connection.nameservers,
    dnsSearchList: connection.dnsSearchList,
    customDns: connection.nameservers.length > 0,
    customDnsSearch: connection.dnsSearchList.length > 0,
  };
}

/**
 * Returns an error when the given list is active and empty or has invalid entries.
 * Returns undefined when inactive or when all entries are valid.
 */
function validateActiveList(
  active: boolean,
  values: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string,
  invalidMsg: string,
): string | undefined {
  if (!active) return undefined;
  if (values.length === 0) return emptyMsg;
  if (values.some((v) => !isValid(v))) return invalidMsg;
}

/**
 * Returns an error for a gateway value under its protocol mode.
 *
 * - `manual`: validates if the gateway is present.
 * - `auto`: validates only when there are already valid addresses; an empty
 *   address list means the gateway will be ignored on submission anyway.
 */
function validateGateway(
  mode: string,
  gateway: string,
  validAddresses: string[],
  isValid: (v: string) => boolean,
  invalidMsg: string,
): string | undefined {
  if (!gateway) return undefined;
  if (mode === "manual") return isValid(gateway) ? undefined : invalidMsg;
  if (mode === "auto" && validAddresses.length > 0)
    return isValid(gateway) ? undefined : invalidMsg;
}

/** Ensures a CIDR string has a prefix, adding a protocol-appropriate default if missing. */
const withPrefix = (address: string): string => {
  if (address.includes("/")) return address;
  return address.includes(":")
    ? `${address}/${IPV6_DEFAULT_PREFIX}`
    : `${address}/${IPV4_DEFAULT_PREFIX}`;
};

/**
 * Validates the connection form values.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid. Validation is intentionally done here rather than in
 * per-field onSubmit validators — see the {@link ConnectionForm} remarks.
 */
function validateConnectionForm(formValues: FormValues): FormFieldErrors | undefined {
  const validAddresses4 = formValues.addresses4.filter(isValidIPv4Address);
  const validAddresses6 = formValues.addresses6.filter(isValidIPv6Address);

  const fieldErrors = shake({
    name: !formValues.name.trim() ? _("Name is required") : undefined,
    addresses4: validateActiveList(
      formValues.ipv4Mode === "manual",
      formValues.addresses4,
      isValidIPv4Address,
      _("At least one IPv4 address is required"),
      _("Some IPv4 addresses are invalid"),
    ),
    addresses6: validateActiveList(
      formValues.ipv6Mode === "manual",
      formValues.addresses6,
      isValidIPv6Address,
      _("At least one IPv6 address is required"),
      _("Some IPv6 addresses are invalid"),
    ),
    gateway4: validateGateway(
      formValues.ipv4Mode,
      formValues.gateway4,
      validAddresses4,
      isValidIPv4,
      _("Invalid IPv4 gateway"),
    ),
    gateway6: validateGateway(
      formValues.ipv6Mode,
      formValues.gateway6,
      validAddresses6,
      isValidIPv6,
      _("Invalid IPv6 gateway"),
    ),
    nameservers: validateActiveList(
      formValues.customDns,
      formValues.nameservers,
      isValidNameserver,
      _("At least one DNS server is required"),
      _("Some DNS server addresses are invalid"),
    ),
    dnsSearchList: validateActiveList(
      formValues.customDnsSearch,
      formValues.dnsSearchList,
      isValidDNSSearchDomain,
      _("At least one DNS search domain is required"),
      _("Some DNS search domains are invalid"),
    ),
  });

  if (!isEmpty(fieldErrors)) return fieldErrors;
}

/**
 * Builds a {@link Connection} from the validated form values.
 */
function buildConnection(formValues: FormValues): Connection {
  const ipv4Addresses =
    formValues.ipv4Mode === "manual" || formValues.ipv4Mode === "auto"
      ? formValues.addresses4.map(withPrefix).map(buildAddress)
      : [];
  const ipv6Addresses =
    formValues.ipv6Mode === "manual" || formValues.ipv6Mode === "auto"
      ? formValues.addresses6.map(withPrefix).map(buildAddress)
      : [];

  return new Connection(formValues.name, {
    iface: formValues.bindingMode === "iface" ? formValues.iface : "",
    macAddress: formValues.bindingMode === "mac" ? formValues.ifaceMac : "",
    method4: MODE_TO_METHOD[formValues.ipv4Mode],
    gateway4: ipv4Addresses.length > 0 ? formValues.gateway4 : "",
    method6: MODE_TO_METHOD[formValues.ipv6Mode],
    gateway6: ipv6Addresses.length > 0 ? formValues.gateway6 : "",
    addresses: [...ipv4Addresses, ...ipv6Addresses],
    nameservers: formValues.customDns ? formValues.nameservers : [],
    dnsSearchList: formValues.customDnsSearch ? formValues.dnsSearchList : [],
  });
}

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
type ConnectionFormContentProps = {
  defaults?: Partial<FormValues>;
  isEditing?: boolean;
};

function ConnectionFormContent({ defaults, isEditing = false }: ConnectionFormContentProps) {
  const navigate = useNavigate();
  const devices = useDevices();
  const { mutateAsync: updateConnection } = useConnectionMutation();

  const form = useAppForm({
    ...mergeFormDefaults(connectionFormOptions, {
      iface: devices[0]?.name ?? "",
      ifaceMac: devices[0]?.macAddress ?? "",
      ...defaults,
    }),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        const fieldErrors = validateConnectionForm(formValues);
        if (fieldErrors) return { fields: fieldErrors };

        try {
          await updateConnection(buildConnection(formValues));
        } catch (e) {
          return { form: e.message };
        }
      },
    },
    onSubmit: () => navigate(-1),
  });

  return (
    <form.AppForm>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          // Validation is intentionally deferred to submission so users are
          // not interrupted while filling the form. All rules live in
          // onSubmitAsync rather than per-field onSubmit validators because
          // several checks are cross-field (e.g. gateway validity depends on
          // the addresses list). TanStack Form only clears field errors set
          // by onSubmitAsync when a per-field onSubmit validator runs for
          // the same cause — which never happens here — so canSubmit stays
          // false after a failed attempt. setErrorMap resets every field's
          // errorMap.onSubmit before each new attempt, restoring canSubmit
          // so onSubmitAsync is called again.
          // @see https://tanstack.com/form/latest/docs/reference/formApi#seterrormap
          form.setErrorMap({ onSubmit: { fields: {} } });
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

        {!isEditing && (
          <form.Field name="name">
            {(field) => {
              const error = field.state.meta.errors[0] as string | undefined;
              return (
                <FormGroup fieldId={field.name} label={_("Name")}>
                  <TextInput
                    id={field.name}
                    value={field.state.value}
                    validated={error ? "error" : "default"}
                    onChange={(_, v) => field.handleChange(v)}
                  />
                  {error && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">{error}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              );
            }}
          </form.Field>
        )}

        <IpSettings form={form} protocol="ipv4" />

        <IpSettings form={form} protocol="ipv6" />

        <form.Field name="customDns">
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
                  <form.AppField name="nameservers">
                    {(field) => (
                      <field.ArrayField
                        label={_("DNS servers")}
                        skipDuplicates
                        validateOnSubmit={(v) =>
                          isValidNameserver(v) ? undefined : _("Invalid DNS server address")
                        }
                      />
                    )}
                  </form.AppField>
                </NestedContent>
              )}
            </>
          )}
        </form.Field>

        <form.Field name="customDnsSearch">
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
                  <form.AppField name="dnsSearchList">
                    {(field) => (
                      <field.ArrayField
                        label={_("DNS search domains")}
                        skipDuplicates
                        validateOnSubmit={(v) =>
                          isValidDNSSearchDomain(v) ? undefined : _("Invalid DNS search domain")
                        }
                      />
                    )}
                  </form.AppField>
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
  );
}

function NewConnectionForm() {
  return <ConnectionFormContent />;
}

function ConnectionNotFound() {
  return (
    <EmptyState headingLevel="h2" titleText={_("Connection not found")} variant="sm">
      <EmptyStateBody>
        {_("The connection does not exist or is no longer available.")}
      </EmptyStateBody>
      <Link to={NETWORK.root} variant="link">
        {_("Back to network")}
      </Link>
    </EmptyState>
  );
}

function EditConnectionForm() {
  const { id } = useParams();
  const { connections: configConns } = useConfig();
  const { connections: systemConns } = useSystem();
  // Merge config and system connections so the form reflects the user's
  // explicit settings (config) while filling gaps from the live system state.
  // Config wins: e.g. configConn.method4 === undefined (the user chose
  // "Automatic", meaning "do not put method in the config") must override
  // systemConn.method4 === "auto" that Agama backend or NetworkManager might
  // report.
  //
  // FIXME: when config has no method (Automatic) but the system connection
  // already has addresses, the merged result will show Automatic while the
  // connection is actually behaving as Advanced. Consider deriving the mode
  // from the system addresses in that case for a more accurate representation.
  const { all: connections } = extendCollection(configConns || [], { with: systemConns });
  const connection = connections.find((c) => c.id === id);

  if (!connection) return <ConnectionNotFound />;

  return <ConnectionFormContent defaults={connectionToFormValues(connection)} isEditing />;
}

/**
 * Form for creating or editing a network connection.
 *
 * @remarks
 * Renders {@link NewConnectionForm} when no route `id` param is present, or
 * {@link EditConnectionForm} when editing an existing connection. Both delegate
 * to {@link ConnectionFormContent} for the shared form rendering.
 *
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
  const { id } = useParams();
  const title = id ?? _("New connection");
  const breadcrumbs = [{ label: _("Network"), path: NETWORK.root }, { label: title }];

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>{id ? <EditConnectionForm /> : <NewConnectionForm />}</Page.Content>
    </Page>
  );
}
