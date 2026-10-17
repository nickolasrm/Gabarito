# @gabarito/tools

**Status:** empty — no code yet

## Responsibility

Interaction: what a pointer drag, a click, or a keystroke *means*.

- The tool contract: activate, deactivate, pointer/key handlers, cancel, and a preview.
- Built-in tools: select, line, rectangle, circle, arc, polygon, push/pull, move, copy, rotate, scale,
  offset, tape measure, paint, erase.
- Interaction state machines — the multi-step nature of "click, drag, click, type a distance, Enter".
- Measurement entry while an operation is in flight.
- Inference application: asking `geometry` for candidates and locks, and showing the results.

## Owns

The translation from input events to **commands**. Never the mutation itself.

## Must not

- Touch the document directly — tools emit commands, and only `core` applies them
  ([invariant 6](../../docs/architecture/invariants.md)).
- Import Three.js. Tools reason about documents and geometry, not render objects.
- Hold authoritative state; a tool's in-flight draft is provisional and disposable.

## Built-in, not a plugin

These ship in the modeler because everyone needs them. A domain gets plugin status when it is
optional ([feature modules](../../docs/features/README.md)).

## Depends on

`@gabarito/core`, `@gabarito/geometry`.

## Read next

[`docs/decisions/0006-document-model-and-commands.md`](../../docs/decisions/0006-document-model-and-commands.md)
