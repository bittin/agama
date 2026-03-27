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

### 2. Always shown, optional or context-dependent

The field is always visible. Use this when hiding the field would hurt
discoverability or when its label needs to reflect the current state of the
form.

If the field is always optional, use the `(optional)` suffix.

If the requirement depends on the state of other fields, use a clarifying
suffix that describes what is currently expected. This is a special case and
should be used sparingly: if you find yourself reaching for it often, the form
likely needs restructuring.

**Example:** IP Addresses. It may become effectively required depending on the
selected configuration mode. The label suffix can adapt to clarify expectations,
for example `(optional)` when configuration is automatic or `(IPv4 required)`
when IPv4 is manually configured.

### 3. Conditionally shown, required when shown

The field is hidden until another field reaches a specific value. When it
appears, it is required. No suffix is needed: the user caused it to appear by
their own action, so its purpose is self-evident.

**Example:** not yet present in `ConnectionForm`. A future example might be a
port or VLAN identifier field that appears only when a specific connection type
is selected and must be filled in.

### 4. Conditionally shown, optional when shown

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

### 5. Choice selector (mode or behavior selection)

A selector allows the user to choose _how_ a feature should behave rather than
whether a single value should be provided. Each option represents a complete
configuration mode. Selecting an option may reveal additional fields that refine
that choice.

Unlike pattern 6, this is not an opt-in toggle. The user must always select one
option, and a sensible default should be preselected whenever possible.

Use this pattern when:

- multiple mutually exclusive configurations exist,
- the system already has a meaningful default behavior,
- hiding configuration entirely would make the form misleading or ambiguous.

The selector communicates that the feature is active regardless of whether the
user customizes it.

Revealed fields are a consequence of the selected option and follow earlier
patterns:

- required fields use pattern 3,
- optional fields use pattern 4.

Field values revealed by a choice must remain preserved in form state when the
user switches options. This allows experimentation without losing previously
entered data.

**Example:** IPv4 Settings selector.

- `Default` — backend decides configuration. No additional fields shown.
- `Custom` — user configures the protocol explicitly. Method selector and
  related fields appear.

This avoids the confusion of a checkbox such as "Configure IPv4", which may
suggest that no IP configuration exists unless enabled.

#### Payload behavior

When a selector represents a default or automatic mode, additional fields
related to other modes might not be included in the submitted payload. The
frontend keeps their values only for user convenience when switching modes.

### 6. Hidden behind a checkbox

A checkbox lets the user explicitly opt into providing a value. The field is
hidden until the checkbox is checked. Once checked, the field is required and
validated on submit. No `(optional)` suffix: the user has signalled intent, so
leaving it blank is a mistake worth reporting.

The field value is preserved in form state when the checkbox is unchecked so
re-checking restores what the user previously typed.

Render the revealed content using `NestedContent` as a sibling after the
`Checkbox`, not via the `Checkbox` body prop. The body prop renders inside a
`<span>`, which is invalid HTML for block content like a form field.

Use this pattern for advanced or rarely needed options that most users should
never see. Do not use it when the field is likely to be needed by the majority
of users: that just adds an unnecessary click.

**Example:** "Use custom DNS servers" checkbox reveals the DNS Servers field.

## Accessibility notes

### Fields without a visible label

Sometimes a field has no visible label because its purpose is clear from
the surrounding context. Even then, every field needs an accessible name for
screen readers, voice control software, and browser translation tools.

Ideally, a real `<label>` element would be kept in the DOM with its text
visually hidden. This is better than `aria-label` because it gets translated
by browser tools, works with voice control software, and does not depend on
ARIA support. However, PatternFly's `FormGroup` reserves visual space for the
label area whenever a label is provided, even when its content is hidden,
leaving an unwanted gap in the layout.

For this reason, `aria-label` is used as the fallback for fields without a
visible label when rendered inside `FormGroup`.

When a component accepts a `label` prop directly and does not reserve visual
space for it (e.g. `ChoiceField`), pass `<Text srOnly>{label}</Text>` as the
label value instead. This preserves translation support and avoids the layout
side effect.

See:

- <https://www.w3.org/WAI/tutorials/forms/labels/>
- <https://adrianroselli.com/2020/01/my-priority-of-methods-for-labeling-a-control.html>
- <https://adrianroselli.com/2019/11/aria-label-does-not-translate.html>
- <https://vispero.com/resources/should-form-labels-be-wrapped-or-separate/>

---

## Combining patterns

Patterns can and should be combined within the same form when different fields
have different needs.

Patterns 2–4 commonly appear inside a choice selector (pattern 5), where
selecting a mode reveals required or optional refinements of that choice.

Patterns 2 and 6 also combine well when a form has one common optional field
alongside a group of rarely needed advanced options.

---

## Choosing the right pattern

Work through these questions in order:

1. Is the field needed by most users and always relevant? Use pattern 1.
2. Should the field always remain visible for clarity or discoverability? Use pattern 2.
3. Does the field become required only after another choice? Use pattern 3.
4. Does the field become optional only after another choice? Use pattern 4.
5. Does the user need to choose between different configuration behaviors or modes? Use pattern 5.
6. Is the field an advanced option that most users will never need? Use pattern 6.

---

## Summary

| Pattern                           | Visibility   | Label                             | Validated on submit |
| --------------------------------- | ------------ | --------------------------------- | ------------------- |
| Required                          | Always       | No suffix                         | Yes                 |
| Always optional/context-dependent | Always       | `(optional)` or clarifying suffix | No                  |
| Conditionally required            | On condition | No suffix                         | Yes                 |
| Conditionally optional            | On condition | `(optional)`                      | No                  |
| Choice selector                   | Always       | No suffix                         | Depends on choice   |
| Checkbox opt-in                   | On checkbox  | No suffix                         | Yes, when shown     |
