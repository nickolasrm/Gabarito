# @gabarito/feature-lighting

**Status:** empty — planned, not started

Plugin id: `gabarito.lighting` · Plan: [`docs/features/lighting-design.md`](../../../docs/features/lighting-design.md)

## Responsibility

Predicting how a space will be lit, in numbers, in a browser tab.

- Luminaire library with photometric data (IES/LDT parsing).
- Fixture entities with position, aim, mounting, and colour temperature.
- Illuminance calculation over measurement grids.
- False-colour overlay rendered into the viewport through the plugin's overlay contribution.
- Uniformity and compliance checks against target levels.
- Daylight contribution and rough energy estimates.
- Reports: fixture schedule, load, illuminance summary.

## Depends on

`@gabarito/plugin-api` only. Nothing else, ever
([boundaries](../../../docs/architecture/module-boundaries.md)).

## Notes for the implementing agent

- The deliverable is **numbers, not pictures**. A beautiful render that cannot answer "how many lux at
  0.8 m?" is a failure.
- Computation runs in the browser with no server, so expect Web Workers, and keep the first
  implementation a documented point-calculation model rather than a full radiosity solution.
- The heatmap overlay is the first serious test of the plugin contract's rendering contribution. If it
  does not fit, that is a contract spec — and it is expected.
