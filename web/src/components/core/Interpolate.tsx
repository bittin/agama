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

export type InterpolateProps = {
  /**
   * A translated string containing exactly one placeholder. Two styles are
   * supported:
   *
   * - `[label]` — the text inside the brackets is extracted and passed to
   *   `children` as the `label` argument.
   * - `%s` — marks the insertion point; `label` will be an empty string since
   *   the caller is expected to supply its own content.
   *
   * If the string contains no placeholder it is rendered as plain text and
   * `children` is never called.
   */
  template: string;
  /**
   * Render prop called with the extracted label.
   *
   * For `[label]` templates the label is the text inside the brackets.
   * For `%s` templates the label is always an empty string — the caller
   * supplies the content directly.
   */
  children: (label: string) => React.ReactNode;
};

/**
 * Renders a translated string that contains a single placeholder, replacing
 * the placeholder with arbitrary React content via a render prop.
 *
 * This is the standard way to inject React elements (links, bold text, etc.)
 * into a translated string without breaking the translation unit. Keeping
 * the full sentence as one string lets translators reorder words freely.
 *
 * Two placeholder styles are supported:
 *
 * - `[label]` — the text inside the brackets is extracted and passed to
 *   `children`, allowing the caller to wrap it in any element.
 * - `%s` — marks the insertion point; the caller provides the full content.
 *
 * Only one placeholder per template is supported. Passing more than one
 * throws an error. A string with no placeholder is rendered as plain text.
 *
 * @example
 * // [label] pattern — label extracted from the translated string
 * <Interpolate template={_("When ready, click on the [install] button.")}>
 *   {(label) => <strong>{label}</strong>}
 * </Interpolate>
 *
 * @example
 * // %s pattern — caller provides the inserted content
 * <Interpolate template={_("Go to the %s section to change this.")}>
 *   {() => <Link to={SETTINGS.root} isInline>{_("Settings")}</Link>}
 * </Interpolate>
 */
export default function Interpolate({ template, children }: InterpolateProps) {
  if (template.includes("%s")) {
    const parts = template.split("%s");
    if (parts.length > 2) throw new Error("Interpolate: only one %s placeholder is supported.");
    const [start, end] = parts;
    return (
      <>
        {start}
        {children("")}
        {end}
      </>
    );
  }

  if (template.includes("[")) {
    const parts = template.split(/[[\]]/);
    if (parts.length > 3)
      throw new Error("Interpolate: only one [label] placeholder is supported.");
    const [start, label, end] = parts;
    return (
      <>
        {start}
        {children(label ?? "")}
        {end}
      </>
    );
  }

  return <>{template}</>;
}
