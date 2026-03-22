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
import Text from "~/components/core/Text";

interface LabelTextProps {
  /** The main label text. */
  children: string;
  /**
   * An optional suffix, e.g. "(optional)".
   *
   * It is rendered in a subtler style to distinguish it from
   * the main label text. This does not matter when label is hidden.
   */
  suffix?: string;
  /**
   * Whether the label should be visually hidden but kept accessible.
   *
   * Use this when a field has no visible label because its purpose is clear
   * from the surrounding context (e.g. a textarea inside a checkbox body).
   * The label text is still present in the DOM so it is translated by browser
   * translation tools and does not rely on ARIA attribute support. Note that
   * the `<label>` element itself is rendered by the parent `FormGroup` — what
   * is hidden here is the text content passed to it.
   *
   * @see https://www.w3.org/WAI/tutorials/forms/labels/
   * @see https://adrianroselli.com/2020/01/my-priority-of-methods-for-labeling-a-control.html
   * @see https://adrianroselli.com/2019/11/aria-label-does-not-translate.html
   * @see https://vispero.com/resources/should-form-labels-be-wrapped-or-separate/
   */
  hidden?: boolean;
}

/**
 * A form field label with optional styling hints.
 *
 * @remarks
 * Supports two presentation modes:
 *
 * - Visible with an optional suffix rendered in a subtler style, used to
 *   communicate whether a field is optional or has a context-dependent
 *   requirement (see `src/components/form/conventions.md`).
 *
 * - Visually hidden, used when the field's purpose is clear from surrounding
 *   context but an accessible label is still needed for screen readers and
 *   browser translation tools.
 */
export default function LabelText({ children, suffix, hidden = false }: LabelTextProps) {
  return (
    <Text srOnly={hidden}>
      {children}
      {suffix && (
        <>
          {" "}
          <Text textStyle={["textColorSubtle", "fontSizeXs", "fontWeightNormal"]}>{suffix}</Text>
        </>
      )}
    </Text>
  );
}
