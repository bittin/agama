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

import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext, useFieldContext, useFormContext } from "~/hooks/form-contexts";
import ArrayField from "~/components/form/ArrayField";
import CheckboxField from "~/components/form/CheckboxField";
import ChoiceField from "~/components/form/ChoiceField";
import TextField from "~/components/form/TextField";

/**
 * Application-wide TanStack Form hook.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
 */
const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    ArrayField,
    CheckboxField,
    ChoiceField,
    TextField,
  },
  formComponents: {},
});

/**
 * Merges runtime-derived values into a `formOptions` object's `defaultValues`.
 *
 * Use this when some defaults depend on runtime data (e.g. values from a hook)
 * that cannot be known when the shared options are defined statically.
 *
 * @example
 * const myFormOpts = formOptions({ defaultValues: { name: "", device: "" } });
 *
 * function MyForm() {
 *   const device = useCurrentDevice();
 *   const form = useAppForm({
 *     ...mergeFormDefaults(myFormOpts, { device: device.name }),
 *     onSubmit: ...,
 *   });
 * }
 */
function mergeFormDefaults<T extends { defaultValues: Record<string, unknown> }>(
  opts: T,
  runtimeDefaults: Partial<T["defaultValues"]>,
): T {
  return { ...opts, defaultValues: { ...opts.defaultValues, ...runtimeDefaults } };
}

export { useAppForm, withForm, mergeFormDefaults, useFieldContext, useFormContext };
