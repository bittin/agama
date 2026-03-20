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
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import { Connection, ConnectionMethod } from "~/types/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { useAppForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

const METHOD_OPTIONS = [
  { value: ConnectionMethod.AUTO, label: _("Automatic (DHCP)") },
  { value: ConnectionMethod.MANUAL, label: _("Manual") },
];

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
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const connection = new Connection(value.name, {
          iface: value.interface,
          method4: value.method4,
          gateway4: value.method4 === ConnectionMethod.MANUAL ? value.gateway4 : undefined,
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

          <form.Field name="method4">
            {(field) => (
              <FormGroup fieldId={field.name} label={_("Method")}>
                <FormSelect
                  id={field.name}
                  value={field.state.value}
                  onChange={(_, v) => field.handleChange(v as ConnectionMethod)}
                >
                  {METHOD_OPTIONS.map((o) => (
                    <FormSelectOption key={o.value} value={o.value} label={o.label} />
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
                    <FormGroup fieldId={field.name} label={_("Gateway")}>
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
