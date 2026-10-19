---
id: 0028
title: Shared definitions and scoped component editing
status: accepted
date: 2026-10-18
tags: [core, components, selection, transforms]
specs: [0038]
---

# 0028 — Shared definitions and scoped component editing

A component definition owns one geometry scope. Instances reference a definition and carry an
invertible affine transform; definitions may contain instances but cannot reference themselves
transitively. Ordinary geometry still uses shared topology inside its own scope (decision 0027).

The store owns the current instance path. Tools receive the active scope in world coordinates;
commands validate that scope before inverse transformation writes back to its definition. All linked
instances therefore share edits without synchronization or copied authoritative geometry. Snapshot
history includes definitions, instances and the context needed to undo an edit.

Rendering, snapping and transform previews use derived flattened geometry. Picking retains scope
ownership, so selection resolves to an atomic instance outside its context. External geometry is
available as a read-only reference and cannot enter topology commands accidentally. View/context
changes do not add undo entries; all document changes do. IDs remain globally monotonic.
