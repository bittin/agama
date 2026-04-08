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
import { Button } from "@patternfly/react-core";
import { useFormContext } from "~/hooks/form-contexts";
import { _ } from "~/i18n";

type SubmitButtonProps = {
  /** Button label. Defaults to "Accept". */
  label?: React.ReactNode;
};

/**
 * A submit button for use inside a form's action group.
 *
 * Reads `isSubmitting` from the form context to show a loading indicator
 * and disable the button while the form is being submitted. Registered as
 * a form component so it is available as `form.SubmitButton`, keeping
 * submit state handling out of form components.
 *
 * @example
 * <ActionGroup>
 *   <form.SubmitButton />
 *   <form.CancelButton />
 * </ActionGroup>
 */
export default function SubmitButton({ label = _("Accept") }: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" isLoading={isSubmitting} isDisabled={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}
