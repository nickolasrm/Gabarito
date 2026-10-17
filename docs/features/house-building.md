# House building

**Plugin:** `packages/features/house` · **Status:** planned · Uses only
[`plugin-api`](../architecture/plugin-contract.md).

The domain that will most test whether the core is genuinely domain-agnostic, because architecture
wants *assemblies, levels, and schedules* — structures that no general modeler has.

## What it is for

Building a house is a layered process: walls have structure (framing, sheathing, cladding, insulation),
floor plans are organised by level, and every element ends up in a schedule and a quantity takeoff. A
modeler can represent the shapes; this plugin supplies the semantics.

## Candidate capabilities

| Capability | Notes |
|---|---|
| Levels / storeys | Named elevations; everything belongs to a level; views and sections are cuts through them. |
| Wall assembly | A wall is a *composite* of layers with thickness and material, not a single slab. Openings cut through the whole assembly. |
| Openings | Doors and windows with frames, sills, and host relationships; the host wall rebuilds around them. |
| Floor / ceiling / roof assemblies | Same layered concept; roofs also bring slopes and intersections. |
| Rooms and areas | Enclosed volumes with names, functions, floor area, and volume — the basis of schedules. |
| Stairs, railings, foundations | Parametric elements that are painful to model by hand and trivial once parameterised. |
| Annotation and plans | Dimensions, tags, room labels, plan sheets at scale, and print-ready output. |
| Schedules and takeoff | Wall areas, material quantities, opening counts, room areas — derived from the model. |
| Site and terrain | A ground surface the building sits on, with simple grading. |

## Where the tension with the core lives

Two concepts here are *not* ordinary plugins and will force contract conversations:

1. **Layered assemblies.** A wall made of layers with an ordered material stack is a different kind of
   entity than a box, and openings must cut through all of it. Either the core gains a generic
   "composite entity with layers" concept (a contract change, with a spec) or the plugin invents its
   own entity type and commands. The plugin route is the default.
2. **Levels and views.** "Show only the ground floor, cut at 1.2 m" is a view concept the core does not
   yet have. Whether views belong to the core or to the plugin is a real decision and belongs in an
   ADR when it comes up.

## What it borrows from the others

Nothing directly — plugins never import each other
([module boundaries](../architecture/module-boundaries.md)). A house model with a lighting study
inside it is composed through the host and through shared document entities, not through a dependency
between the two plugins.

## Open questions to settle in a spec

- Levels: core concept or plugin concept? (Leaning plugin, with a contract slot for view filters.)
- Do assemblies serialise as ordered layer stacks in plugin namespaced data, or as first-class core
  entities?
- How much of a plan sheet is geometry and how much is layout? Sheet layout may be its own plugin.
- Openings and host walls: parametric and re-solving on edit, or baked with a link?

Related: [feature modules](./README.md), [plugin contract](../architecture/plugin-contract.md),
[module boundaries](../architecture/module-boundaries.md).
