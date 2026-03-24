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

import React, { useState } from "react";
import {
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from "@patternfly/react-core";
import { useFieldContext } from "~/hooks/form-contexts";

export type ChoiceOption<T> = {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  isDisabled?: boolean;
};

type ChoiceFieldProps<T> = {
  /** The field label. */
  label: React.ReactNode;
  /** The available options. */
  options: ChoiceOption<T>[];
  /** Optional helper text shown below the select. */
  helperText?: React.ReactNode;
  isDisabled?: boolean;
  /**
   * Render prop for content that depends on the current value, such as
   * nested fields that appear when a specific option is selected.
   */
  children?: (value: T) => React.ReactNode;
};

/**
 * A form field that renders a select tied to a TanStack Form field via
 * `useFieldContext`. Must be used inside a `form.Field` render prop.
 *
 * Supports a render prop `children` for dependent content that should appear
 * or change based on the selected value. Field values are preserved in form
 * state when hidden, so switching back to a previous option restores what the
 * user entered.
 *
 * @example
 * <form.AppField name="ipv4Mode">
 *   {(field) => (
 *     <field.ChoiceField label={_("IPv4 Settings")} options={IPV4_MODE_OPTIONS}>
 *       {(value) => value === "custom" && <CustomIpv4Fields />}
 *     </field.ChoiceField>
 *   )}
 * </form.AppField>
 */
export default function ChoiceField<T extends string>({
  label,
  options,
  helperText,
  isDisabled = false,
  children,
}: ChoiceFieldProps<T>) {
  const field = useFieldContext<T>();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === field.state.value);

  return (
    <FormGroup fieldId={field.name} label={label}>
      <Select
        isOpen={isOpen}
        selected={field.state.value}
        onSelect={(_, value) => {
          if (typeof value === "string") field.handleChange(value as T);
          setIsOpen(false);
        }}
        onOpenChange={setIsOpen}
        shouldFocusToggleOnSelect
        toggle={(ref: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            id={field.name}
            ref={ref}
            onClick={() => setIsOpen((o) => !o)}
            isExpanded={isOpen}
            isDisabled={isDisabled}
          >
            {selectedOption?.label ?? field.state.value}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map((opt) => (
            <SelectOption
              key={opt.value}
              value={opt.value}
              description={opt.description}
              isDisabled={opt.isDisabled}
            >
              {opt.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
      {helperText}
      {children?.(field.state.value)}
    </FormGroup>
  );
}
