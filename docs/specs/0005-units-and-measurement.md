---
id: 0005
title: Units and measurement
status: implemented
date: 2026-10-17
packages: [core, tools, ui]
decisions: [0008, 0012]
supersedes: null
---

# 0005 — Units and measurement

## Goal

Make the unit a first-class setting that **drives** the drawing tools, the typed-value shortcuts, and
every measurement the user sees. After this spec, a user picks millimetres or feet-and-inches and every
number in the UI, in typed input, and in live readouts means that unit.

## Why now

Units are the input and output vocabulary of every tool in
[spec 0007](./0007-drawing-and-transform-tools.md). Retrofitting them after the tools exist means
touching every tool twice.

## Scope

**In scope**

- A unit registry in `core`: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, each with a millimetre factor, a
  label, and a suffix.
- `parseLength(text, unit) → millimetres` and `formatLength(mm, unit) → string`, plus
  `formatAngle(radians)` in degrees.
- A unit selector in the UI that changes the setting through a command, so it is undoable and visible
  to the tools.
- Live readouts and typed input everywhere expressed in the current unit.
- A status bar showing: current unit, the typed buffer, and the live measurement of the operation in
  progress.

**Out of scope**

- Architectural feet-and-inches with fractions (for example `3' 6 1/2"`). Decimals in the current
  unit for this slice; fractional imperial is a follow-up spec.
- Per-document units, unit-aware imported geometry, and dimensional analysis.
- Angles as a user-selectable unit: always degrees on screen, radians internally
  ([decision 0008](../decisions/0008-units-coordinates-precision.md)).

## Plan

1. `packages/core/src/units.ts`: the registry, `parseLength`, `formatLength`, `formatAngle`,
   `formatArea`, `convert`.
2. `Settings.unit` in the store, changed by a `setSettings` command.
3. The tool input controller parses typed numbers with the current unit at commit time.
4. UI: a unit `<select>` in the settings panel, and a status bar rendering unit, buffer, and readout.
5. Tests: round-trip parse/format per unit, imperial and metric spot checks, tolerance on decimals.

## Design notes

The document stores millimetres and knows nothing about display units; a single preference decides how
those numbers are shown and typed. That keeps conversion in exactly two places — the parser and the
formatter — instead of distributed through the tools.

Typed values are parsed **at commit time** from the raw text buffer, so changing the unit mid-typing
changes the meaning, which matches the "units drive the tools" requirement.

## Risks

| Risk | Mitigation |
|---|---|
| Floating-point noise in formatted output | Format with a fixed, per-unit sensible precision; trim trailing zeros. |
| A tool that forgets to use the unit | Tools never read settings directly; they go through the shared input/format helpers. |
| Typed input ambiguity (`1.5.2`, `1,5`) | The parser accepts one separator and rejects malformed input by ignoring the commit and keeping the buffer visible. |

## Verification

- [ ] `100` in mm, cm, m, in, ft, yd round-trips through parse and format
- [ ] The rectangle tool draws 1000 mm when the user types `100` with metres selected
- [ ] Switching units changes existing readouts without changing stored geometry
- [ ] Status bar shows unit, buffer, and live measurement

## Docs to update

- [ ] `CHANGELOG.md`, `docs/specs/README.md`, `docs/glossary.md` if new terms appear
- [ ] `packages/core/README.md` (units API), `packages/ui/README.md` (status bar)

## Result

- **Status:** implemented on 2026-10-17
- **What shipped:** the unit registry (`mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`), `parseLength`,
  `parseAngle`, `formatLength`, `formatLengthWithUnit`, `formatArea`, `formatAngle`, a unit selector
  in the settings panel, and a status bar showing the unit, the typed buffer and the live measurement
  of the operation in progress. Typed values are parsed at commit time, and an explicit suffix
  (`5m`, `12"`) overrides the current unit.
- **Deviations from the plan:** none. Fractional imperial (`3' 6 1/2"`) remains out of scope as
  written.
- **Follow-up specs:** fractional imperial formatting for the woodworking domain.
