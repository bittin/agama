import React from "react";
import Text from "~/components/core/Text";

/**
 * A visually hidden label for form fields that lack a visible label.
 *
 * @remarks
 * Some fields do not have a visible label because their purpose is clear from
 * the surrounding context (e.g. a textarea inside a checkbox body). These
 * fields still need an accessible name for screen readers and other assistive
 * technology.
 *
 * This component renders a real `<label>` element that is visually hidden but
 * present in the DOM. This is preferred over `aria-label` because:
 *
 * - It is translated by browser translation tools (Google Translate, etc.),
 *   whereas `aria-label` is not.
 * - It does not rely on ARIA support: the screen reader reads real DOM text
 *   rather than an ARIA attribute, which is inherently more robust.
 *
 * Use this component when a field has no visible label but needs one for
 * accessibility. If a visible label is possible, prefer that instead.
 *
 * @see https://www.w3.org/WAI/tutorials/forms/labels/
 * @see https://adrianroselli.com/2020/01/my-priority-of-methods-for-labeling-a-control.html
 * @see https://adrianroselli.com/2019/11/aria-label-does-not-translate.html
 */
export default function HiddenLabel({ children }: { children: string }) {
  return <Text srOnly>{children}</Text>;
}
