# Form conventions

This document captures the conventions for building forms across the
application. It was written alongside the reimplementation of `ConnectionForm`,
which serves as the running example throughout. That form is intentionally
simple and still incomplete, which makes it a good starting point: the patterns
emerge clearly without the noise of a fully featured form.

As more forms are reimplemented, this document should be updated with new
examples and refined patterns.

## Core principle

Show only what the user needs, when they need it. A form that shows fewer
fields is easier to fill, easier to understand, and less likely to confuse.
Every field that appears should have a clear reason to be there.

## Patterns

The patterns below are ordered from least to most intrusive on the user's
workflow. Prefer patterns near the top when possible.

### 1. Required field, no suffix

The field is always shown and always expected to have a value. If a sensible
default can be provided, pre-fill it. The user may change it or leave it as-is,
but it cannot be blank on submit.

Note: a pre-filled field is still required. Do not add an `(optional)` suffix
just because the field has a default value.

**Current example:** Interface. It is always needed and defaults to the first
available device.

**Not yet an example:** Name. It will have an auto-generated default derived
from the selected interface, but that is not implemented yet.

### 2. Conditionally shown, required when shown

The field is hidden until another field reaches a specific value. When it
appears, it is required. No suffix is needed: the user caused it to appear by
their own action, so its purpose is self-evident.

**Example:** not yet present in `ConnectionForm`. A future example might be a
port or VLAN identifier field that appears only when a specific connection type
is selected and must be filled in.

### 3. Conditionally shown, optional when shown

The field is hidden until another field reaches a specific value. When it
appears it can legitimately be left blank, so it carries the `(optional)`
suffix.

**Example:** IPv4 Gateway and IPv6 Gateway. They are hidden when the
corresponding method is automatic. When the method is set to manual they
appear, but even then a gateway is not strictly required by NetworkManager.

Showing the field directly, rather than behind a checkbox, is the right choice
here because the user has already made a related decision: they chose manual
mode. Asking them to also check a box to reveal the gateway would be an extra
step with no benefit. The field appears naturally as part of the consequence of
their choice.

### 4. Always shown, optional or context-dependent

The field is always visible. Use this when hiding the field would hurt
discoverability or when its label needs to reflect the current state of the
form.

If the field is always optional, use the `(optional)` suffix.

If the requirement depends on the state of other fields, use a clarifying
suffix that describes what is currently expected. This is a special case and
should be used sparingly: if you find yourself reaching for it often, the form
likely needs restructuring.

**Example:** IP Addresses. It is always shown because it can become effectively
required depending on the selected method. The label suffix adapts:
`(optional)` when both methods are automatic, `(IPv4 required)` when only IPv4
is manual, and so on.

### 5. Hidden behind a checkbox

A checkbox lets the user explicitly opt into providing a value. The field is
hidden until the checkbox is checked. Once checked, the field is required and
validated on submit. No `(optional)` suffix: the user has signalled intent, so
leaving it blank is a mistake worth reporting.

The field value is preserved in form state when the checkbox is unchecked, so
re-checking restores what the user previously typed.

Use this pattern for advanced or rarely needed options that most users should
never see. Do not use it when the field is likely to be needed by the majority
of users: that just adds an unnecessary click.

**Example:** "Use custom DNS servers" checkbox reveals the DNS Servers field.
Most users rely on automatic DNS and will never check this box.

## Accessibility notes

### Fields without a visible label

Sometimes a field has no visible label because its purpose is clear from
the surrounding context, such as a textarea inside a checkbox body. Even then,
every field needs an accessible name for screen readers, voice control software,
and browser translation tools.

The quickest fix is `aria-label` directly on the input. It works well and is
widely supported. However, keeping a real `<label>` element in the DOM is
generally better: it gets translated by tools like Google Translate, it works
with voice control software, and it does not depend on ARIA support at all.

To achieve that, just use the src/components/form/`LabelText` component with
the `hidden` prop for the `FormGroup` label prop. The `FormGroup` will render
a `<label for="{id}">` whose text content is visually hidden, so sighted users
never see it but assistive technology always finds it.

**Example:** The textarea that sits inside the "Use custom DNS servers"
checkbox body has no visible label for it. `<LabelText hidden>` provides the
accessible name without cluttering the UI.

See: <https://www.w3.org/WAI/tutorials/forms/labels/>
See: <https://adrianroselli.com/2020/01/my-priority-of-methods-for-labeling-a-control.html>
See: <https://adrianroselli.com/2019/11/aria-label-does-not-translate.html>
See: <https://vispero.com/resources/should-form-labels-be-wrapped-or-separate/>

## Combining patterns

Patterns 4 and 5 can work well together. If a form has one common optional
field alongside a group of rarely needed advanced options, show the common
field directly with an (optional) suffix and hide the rest behind a checkbox.
For example: in the storage partition form, a file system label could sit next
to the file system selector as a plain optional field, while the remaining
advanced options might be hidden behind a "More file system options" checkbox.
The user can set the label without ever seeing the rest.

## Choosing the right pattern

Work through these questions in order:

1. Is the field needed by most users and always relevant? Use pattern 1.
2. Does the field only make sense when another field has a specific value, and
   is it required when shown? Use pattern 2.
3. Does the field only make sense when another field has a specific value, but
   is optional when shown? Use pattern 3.
4. Should the field always be visible because hiding it would hurt
   discoverability or because its label reflects form state? Use pattern 4.
5. Is the field an advanced option that most users will never need? Use pattern 5.

These questions apply per field. Patterns can and should be combined within the
same form when different fields have different needs. See the Combining
patterns section above for an example.

## Summary

| Pattern                              | Visibility   | Label                             | Validated on submit |
| ------------------------------------ | ------------ | --------------------------------- | ------------------- |
| Required                             | Always       | No suffix                         | Yes                 |
| Conditionally required               | On condition | No suffix                         | Yes                 |
| Conditionally optional               | On condition | `(optional)`                      | No                  |
| Always optional or context-dependent | Always       | `(optional)` or clarifying suffix | No                  |
| Checkbox opt-in                      | On checkbox  | No suffix                         | Yes, when shown     |
