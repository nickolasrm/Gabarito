---
id: 0014
title: Guides and dimensions are first-class, non-geometric entities
status: accepted
date: 2026-10-17
tags: [core, annotations, guides, document-model]
supersedes: []
superseded_by: null
specs: [0006, 0007]
---

# 0014 — Guides and dimensions are first-class, non-geometric entities

## Context

The ruler creates construction lines, and the measure tool reports distances. Both are things the user
can see and snap to, but neither is part of the model: a guide does not become a wall, and a dimension
is not a face.

The choice is between keeping them purely in tool state (ephemeral, visible only during an operation),
storing them as ordinary geometry (edges and faces), or giving them their own place in the document.

The requirement that **virtual edges and vertices created from guides count for snapping** pushes
against the ephemeral option: a guide created ten minutes ago must still be snappable, so it must
survive tool deactivation and be visible to the inference engine.

## Decision

Guides and dimensions are **document entities** with their own kinds, stored alongside geometry and
participating in the entity graph, but **excluded from geometric operations**.

- `guide`: an infinite construction line defined by an origin and a direction. It is snappable as a
  virtual edge, and its intersections with other guides and with edges are snappable as virtual
  vertices. It is never an operand of push/pull, extrusion, or a boolean.
- `dimension`: a distance annotation between two points with an offset for its label. It has no
  geometric role at all.
- Both are selectable and deletable like any other entity, and both may be hidden without being
  deleted.
- Guides and dimensions carry their own display styling (dashed, thin, distinct colour) and are not
  rendered by the solid-geometry path.
- Geometric operations **filter by kind**: they operate on points, edges, and faces, and skip
  annotations by construction rather than by convention.

## Consequences

**Good:** a guide survives the tool that made it, which is exactly what makes guide-based snapping and
layout workflows possible; "virtual geometry counts" is implementable because guides are queryable
document state; guides and dimensions are undoable, selectable, hideable and serialisable through the
same machinery as everything else, with no special cases in undo or persistence; the kind field gives
the renderer and the geometry kernel a natural filter, so annotations cannot leak into solid operations
by accident.

**Bad:** the document format and every query must now handle kinds that carry no geometry, which is a
small but permanent tax on `core` and `persistence`; "entity" now means two different things — something
you build with, and something you annotate with — and a reader of the type definitions must notice the
distinction; a user who expects a guide to become an edge when they draw over it will be surprised,
because that promotion does not exist.

**Neutral:** plugins will want their own annotation kinds (a woodworking callout, a lighting grid), and
this record makes that a matter of adding a kind rather than inventing a parallel system. Whether
annotations get their own top-level collection rather than living in the same map is a format decision
deferred to the persistence spec.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep guides in tool state only | They vanish with the tool, so accumulated guides — the entire point of the ruler — are impossible. |
| Store guides as ordinary infinite edges | No edge is infinite; every distance, bounds, and extrusion computation would need a special case. |
| Store dimensions as geometry (edges plus text) | Pollutes the model: dimension lines would be selectable as walls and would be extruded by push/pull. |
| A separate side-channel store outside the document | Breaks undo, save/load, and selection uniformity, and forces every consumer to know about a second state tree. |
| Recompute guides from a recipe | Elegant, but fragile: editing or deleting the source geometry silently changes or destroys the guide. |

## Links

- Related: [0006](./0006-document-model-and-commands.md), [0013](./0013-curves-are-tessellated.md)
- Specs: [0006](../specs/0006-snapping-inference-axis-locks.md), [0007](../specs/0007-drawing-and-transform-tools.md)
