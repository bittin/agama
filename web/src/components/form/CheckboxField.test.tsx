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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import CheckboxField from "./CheckboxField";

function CheckboxFieldForm({ defaultValue = false }: { defaultValue?: boolean }) {
  const form = useAppForm({ defaultValues: { flag: defaultValue } });

  return (
    <form.AppForm>
      <form.AppField name="flag">
        {(field) => <field.CheckboxField label="My checkbox" />}
      </form.AppField>
    </form.AppForm>
  );
}

describe("CheckboxField", () => {
  it("renders the label", () => {
    installerRender(<CheckboxFieldForm />);
    expect(screen.getByLabelText("My checkbox")).toBeInTheDocument();
  });

  it("is unchecked when the value is false", () => {
    installerRender(<CheckboxFieldForm defaultValue={false} />);
    expect(screen.getByLabelText("My checkbox")).not.toBeChecked();
  });

  it("is checked when the value is true", () => {
    installerRender(<CheckboxFieldForm defaultValue={true} />);
    expect(screen.getByLabelText("My checkbox")).toBeChecked();
  });

  it("toggles when clicked", async () => {
    const { user } = installerRender(<CheckboxFieldForm />);
    await user.click(screen.getByLabelText("My checkbox"));
    expect(screen.getByLabelText("My checkbox")).toBeChecked();
  });
});
