# Lighting design

**Plugin:** `packages/features/lighting` · **Status:** planned · Uses only
[`plugin-api`](../architecture/plugin-contract.md).

The domain most likely to strain the renderer and the geometry kernel, because it needs *simulation*,
not just display.

## What it is for

Lighting design is the practice of predicting how a space will be lit *before* it exists: which
fixtures, at what spacing, producing how much light where, at what cost in energy. Existing tools are
either expensive workstation software or spreadsheets. A browser tool that answers "is this room
bright enough?" is genuinely useful.

## Candidate capabilities

| Capability | Notes |
|---|---|
| Fixture library | Luminaires with photometric data (IES/LDT profiles), colour temperature, wattage, beam angle, mounting. |
| Fixture entity and placement | Instances with position, aim, and mounting type, snapped to ceilings and grids. |
| Room / surface model | Surfaces with reflectance properties — the core model supplies geometry; the plugin supplies material behaviour. |
| Lux / illuminance calculation | Point-by-point and grid-average illuminance from luminaires, honouring the inverse-square law, incidence angle, and luminous intensity distribution. |
| False-colour overlay | A heatmap rendered into the viewport through the plugin's contribution, showing lux across a working plane. |
| Uniformity and compliance checks | Ratios and thresholds against target levels for the space type. |
| Daylight | Rough daylight factor or sun-path contribution, using the sun position the core already models for shadows. |
| Reports | Fixture schedule, load, energy estimate, and illuminance summary. Exportable. |
| Aiming and distribution views | Visualise beam cones and spacing. |

## What makes it hard

- **Physically-based visuals are not the deliverable; numbers are.** A pretty render that cannot
  answer "how many lux at 0.8 m?" is a failure. The plugin's centre of gravity is calculation, not
  shading.
- **Photometric data is real data.** IES files are a specific format with real-world sloppiness, and
  parsing them is a project in itself.
- **Computation volume.** A room with 200 luminaires and a fine measurement grid is a lot of arithmetic
  — and it has to run in a browser tab with no server
  ([decision 0001](../decisions/0001-static-hosting-github-pages.md)). Web Workers and, later, WASM
  are the expected tools.
- **The heatmap needs a rendering surface the core does not have.** This is the strongest argument for
  the plugin contract including a rendering-contribution slot, and the first place the contract will
  probably need to grow.

## Open questions to settle in a spec

- Does the plugin own its own viewport overlay, or ask `scene` for a documented overlay slot? The
  latter, presumably — and that is a contract spec.
- How is a calculation scoped and cached so that moving a wall does not silently invalidate a report?
- Do we implement a full radiosity/ray-traced solution, or a well-documented point-calculation model
  first? (Almost certainly the latter.)
- How do results persist in the `.gabarito` file — inputs only, or cached outputs too?

Related: [feature modules](./README.md), [rendering decision](../decisions/0003-rendering-engine-threejs.md),
[plugin contract](../architecture/plugin-contract.md).
