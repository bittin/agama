# Form conventions

This document captures the conventions achieved during the reimplementation
of the application forms, starting with the network connection form. They apply
to all forms across the application.

## Field visibility

Show only the fields that are needed. The default state of a form should be as
minimal as possible, with only fields that are always relevant visible on first
render.

Fields that are only relevant under certain conditions should be hidden until
that condition is met. Whether a conditionally shown field is required or
optional depends on the field itself, not on the fact that it was hidden.

## Field labels and suffixes

### No suffix, required field

The default. A field with no suffix is expected to have a value.

Before rendering a field without a suffix, consider whether a sensible default
value can be provided. If so, pre-fill it. A field with a default is not
optional, it just has a pre-filled value, and the user may or may not change it.

### `(optional)` suffix

Used when a field can legitimately be left blank. The field may be always
visible or conditionally visible, it does not matter. What matters is that
leaving it blank is valid.

Before reaching for `(optional)`, consider whether the field can simply be
hidden. If a field is only relevant under a specific condition and is always
required under that condition, hiding it until needed is cleaner than showing
it with a suffix.

`(optional)` is appropriate when the field must be rendered and can be left
blank, for example because hiding it would harm usability or the workflow.

### Clarifying suffix

Used in rare cases where the requirement is neither simply "required" nor
simply "optional", for example when a field serves multiple protocols and the
requirement depends on the state of other fields. In these cases a short suffix
describes what is expected, e.g. `(IPv4 required)` or
`(IPv4 and IPv6 required)`.

This pattern should be used sparingly. If it appears often, it is likely a sign
that the form might be restructured.

## Summary

| Situation                                                     | Approach                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| Field always required                                         | Show with no suffix                                        |
| Field only relevant conditionally, always required when shown | Hide until condition is met, show with no suffix           |
| Field only relevant conditionally, optional when shown        | Hide until condition is met, show with `(optional)` suffix |
| Field must always show, has a sensible default                | Show with no suffix, pre-fill the default                  |
| Field must always show, no default, can be blank              | Show with `(optional)` suffix                              |
| Field must show, requirement depends on other fields          | Show with clarifying suffix                                |
