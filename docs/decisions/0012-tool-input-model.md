---
id: 0012
title: Typed values and axis locking belong to the input layer
status: accepted
date: 2026-10-17
tags: [tools, input, ux, conventions]
supersedes: []
superseded_by: null
specs: [0005, 0006, 0007]
---

# 0012 — Typed values and axis locking belong to the input layer

## Context

Two behaviours requested for the modeler are needed by *every* tool: typing a number to set the size of
what is being drawn, and pinning an axis with the arrow keys. Nine tools need them on day one, and
every future tool and plugin tool will as well.

Implementing them per tool means nine implementations that drift: one accepts `100,50`, another wants
`100x50`; one locks on the arrow keys, another locks on modifiers; one shows the buffer, another does
not. Users experience that as an unreliable tool, and agents discover it only by reading every tool.

## Decision

Typed value entry and axis locking are implemented **once, in the tool input layer**, not inside
individual tools.

- The input controller owns the typed buffer, its rendering in the status bar, and the `Enter`/`Esc`
  semantics. It parses values in the current display unit at commit time.
- A tool **declares** the shape of the numbers it accepts — arity, meaning, and whether the last one is
  an angle — and receives them as a resolved value. It never sees raw text.
- The controller owns the axis-lock state: the arrow keys set it, `Esc` and tool completion clear it,
  and the resolver projects pointer positions onto the lock.
- A tool requests constraint through the shared resolver rather than testing keys itself.
- The active lock and the typed buffer are drawn from controller state, so every tool gets identical
  feedback for free.

## Consequences

**Good:** one implementation of two cross-cutting behaviours; new tools get both for free, including
plugin tools; feedback, key handling, and unit parsing are identical everywhere and are tested once;
a tool file stays a small state machine about geometry instead of a small state machine about
keyboards.

**Bad:** the controller becomes a required collaborator, so tools cannot be unit-tested without it —
mitigated by giving tools a narrow, fakeable context; a tool with genuinely unusual numeric input (an
array count, a comma-separated list of angles) does not fit the declared shape and needs a contract
extension; the shared resolver limits a tool's freedom to define its own snapping, which will be felt
when a tool wants to snap only to one kind of thing.

**Neutral:** the number of typed values a tool accepts becomes part of its declaration, so the UI can
display an example (`type 100, 50`) without knowing the tool.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Each tool parses its own typed input | Guarantees the drift this record exists to prevent. |
| Global keyboard handlers in the UI package | Puts input semantics in the presentation layer, where tools cannot test against them. |
| A third-party state machine library per tool | Adds a dependency and does not address the shared semantics problem at all. |
| Axis locking as a viewport concern | Locking is about the tool's operation, not the camera; the viewport only draws the indicator. |

## Links

- Specs: [0005](../specs/0005-units-and-measurement.md), [0006](../specs/0006-snapping-inference-axis-locks.md),
  [0007](../specs/0007-drawing-and-transform-tools.md)
- Related: [0006](./0006-document-model-and-commands.md), [0008](./0008-units-coordinates-precision.md)
