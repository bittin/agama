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
   * A translated sentence containing exactly one placeholder.
   */
  sentence: string;
  /**
   * Render prop called with the text extracted from the placeholder.
   *
   * For `[marker]` sentences the text is whatever the translator wrote inside
   * the brackets. For printf sentences the text is always an empty string.
   */
  children: (text: string) => React.ReactNode;
};

/**
 * Renders a translated sentence that contains a single placeholder, replacing
 * it with arbitrary React content via a render prop.
 *
 * This is the standard way to inject React elements (links, bold text, etc.)
 * into a translated string without breaking the translation unit. Keeping the
 * full sentence as one string lets translators reorder words freely.
 *
 * Two placeholder styles are supported:
 *
 * - `%s` / `%d` / `%f` / `%i`: standard gettext printf placeholders. Use these
 *   when the injected element has its own content (e.g. a link wrapping a
 *   dynamic count) and the translation already uses a printf specifier.
 * - `[marker]`: the text inside the brackets is extracted and passed to
 *   `children`. Use this when the translated string already carries the text
 *   for the injected element and you want to wrap it in a React node.
 *
 * Only one placeholder per sentence is supported. Passing more than one (or an
 * unmatched bracket) throws an error. A sentence with no placeholder is
 * rendered as plain text.
 *
 * @example
 * // %d: caller supplies the full content; text argument is always "".
 * <Interpolate sentence={_("There are %d issues")}>
 *   {() => <Link to={ISSUES.root}>{count}</Link>}
 * </Interpolate>
 *
 * @example
 * // [marker]: extracted text becomes the element content.
 * <Interpolate sentence={_("When ready, click the [install] button.")}>
 *   {(text) => <strong>{text}</strong>}
 * </Interpolate>
 *
 * @example
 * // [marker]: inline action embedded in helper text.
 * <Interpolate sentence={_("Select entries to edit or remove them. Or [remove all invalid entries.]")}>
 *   {(text) => <Button variant="link" isInline onClick={clearInvalid}>{text}</Button>}
 * </Interpolate>
 */
export default function Interpolate({ sentence, children }: InterpolateProps) {
  // Supported printf specifiers: %s (string), %d (decimal), %f (float), %i (integer).
  const printfParts = sentence.split(/%[sdfi]/);

  if (printfParts.length > 1) {
    if (printfParts.length > 2)
      throw new Error("Interpolate: only one printf placeholder is supported.");
    const [start, end] = printfParts;
    return (
      <>
        {start}
        {children("")}
        {end}
      </>
    );
  }

  const parts = sentence.split(/[[\]]/);

  if (parts.length === 1) return <>{sentence}</>;

  if (parts.length !== 3)
    throw new Error("Interpolate: exactly one [marker] placeholder is supported.");

  const [start, text, end] = parts;
  return (
    <>
      {start}
      {children(text ?? "")}
      {end}
    </>
  );
}
