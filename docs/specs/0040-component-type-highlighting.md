---
id: 0040
title: Highlight component types from sidebar previews
status: implemented
date: 2026-10-19
packages: [core, scene, ui, app]
decisions: [0028]
---

# 0040 — Highlight component types from sidebar previews

## Goal and plan

The owner clarified that preview clicks should highlight one component type, not all components.
Remove the general toggle. Click a definition preview to highlight every occurrence of that type;
click it again to clear, or click another preview to switch types. Parent highlights include nested
contents; child highlights include child occurrences inside any parent. Other definitions and loose
geometry keep their normal appearance. Preserve active-context highlighting, selection and history.

Carry definition ancestry in derived scene geometry rather than parsing IDs. Keep preview drag/drop
placement unchanged. Show the active preview with aria-pressed, explain click/drag in its tooltip,
and clear highlight state if the definition is removed. No new document command or dependency.

## Verification

Test ancestry across linked/nested/unrelated definitions. Browser tests cover preview click,
switching, clearing, document immutability, deletion cleanup, absence of the general toggle and
continued native drag/drop. Run headless and component browser regressions, typecheck and build;
update owning docs and PR #16. Keep port 5173 available. No merge without fresh approval.

## Result

Implemented per-type highlighting through preview clicks, with toggle/switch behavior and an active
preview border/aria-pressed state. Removed the general button and boolean viewport API. Derived
primitive ancestry resolves all matching nested/linked occurrences without parsing entity IDs.
Definition removal clears stale UI/view state; selection, history and active-context feedback remain
unchanged. Native preview drags still place instances and do not activate click highlighting.

Validation: 208 headless tests, nine component browser workflows, typecheck and static build pass.
Coverage includes nested ancestry, unrelated types, switching, clearing, deletion cleanup, absence
of the old button and native drag placement. No dependencies or document commands added.
