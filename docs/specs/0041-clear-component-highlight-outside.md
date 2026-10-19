---
id: 0041
title: Drive component highlights from normal selection
status: implemented
date: 2026-10-19
packages: [ui]
decisions: [0028]
---

# 0041 — Drive component highlights from normal selection

## Plan

The owner first requested outside-click dismissal, then clarified that normal selection should drive
component highlighting. Selecting one component instance highlights every occurrence of its type
through the existing viewport mechanism, without selecting the other instances. Selecting loose
geometry, empty space or a mixed selection clears the type highlight and preview pressed state.

Preview clicks retain their existing toggle/switch behavior until the next selection change. Derive
highlights from the selected entity in React; no separate hit query or outside-click handler is
needed. Preserve native tool input, edit-context highlighting, navigation, drag placement and history.
The owner's explicit correction accepts this scope.

## Verification

Browser regressions cover linked-type highlighting from selection, switching types, one selected
instance, outside/loose-geometry clearing, preview reactivation and unchanged geometry. Run headless
and component browser suites, typecheck and static build; update owning docs and PR #16. No merge
without fresh approval.

## Result

Normal single-component selection now drives the existing per-type viewport highlight and sidebar
pressed state. Other instances remain unselected. Non-component, empty and multiple selections
clear it. Preview clicks retain toggle/switch behavior until a selection change. The implementation
replaces the old deletion-only cleanup effect with selection-derived feedback; no app hit-query API,
outside-click handler or document command was needed.

Validation: 208 headless tests, all eleven component browser workflows, typecheck and static build
pass. New browser cases verify linked instances, type switching, normal loose-face selection,
outside clearing, preview reactivation and unchanged document geometry. No dependencies added.
