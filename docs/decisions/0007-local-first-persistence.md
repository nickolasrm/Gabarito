---
id: 0007
title: Local-first persistence with no backend
status: accepted
date: 2026-10-17
tags: [persistence, storage, offline, file-format, privacy]
supersedes: []
superseded_by: null
specs: [0001]
---

# 0007 — Local-first persistence with no backend

## Context

With no server ([0001](./0001-static-hosting-github-pages.md)), the browser is the only place a user's
model can live. That is a real constraint but also an alignment with the audience: woodworkers,
lighting designers, and home builders tend to work on their own machine and care about not shipping
their plans somewhere.

At the same time, "local only" must not mean "lose your work when the tab crashes" or "cannot move a
file between machines".

## Decision

Persistence is **local-first**, layered by durability, with a portable file as the source of truth
the user controls:

- **Working state:** the current document is autosaved to **IndexedDB** (with **OPFS** as the
  preferred backend where available, for large binary payloads). Autosave is debounced and never
  blocks the UI.
- **Explicit save:** where the **File System Access API** exists, the user saves a `.gabarito` file
  to a location of their choosing and can hold a persistent handle to it. Where it does not, the
  app falls back to download + import, which is the honest degradation for a static host.
- **Project file:** one container, `.gabarito`, that is a **versioned, zip-based** bundle holding a
  JSON manifest (format version, units, plugin data keyed by plugin id), JSON for the document graph,
  and binary buffers (mesh data, textures) as separate entries so they stream instead of being
  base64-inflated.
- **Forward compatibility:** the manifest declares `formatVersion` and the plugin schemas present.
  Unknown plugin data is **preserved verbatim** on load and re-saved, so opening a file in an older
  build does not destroy newer data.
- **No implicit network.** Nothing is uploaded. There is no telemetry, no cloud sync, no accounts.
  Any future sharing must be an explicit, user-initiated export.
- **Crash safety:** recovery snapshots are kept for the most recent N edits so a closed tab can be
  reopened.

## Consequences

**Good:** privacy is structural, not a policy; works offline and on a plane; no storage bill and no
data-loss liability on our side; the portable file makes the product trustworthy for a professional
who will not adopt a tool that holds their models hostage; zip-based binary entries keep large models
from ballooning through base64; preserving unknown plugin data makes plugin removal and re-addition
safe.

**Bad:** no built-in sharing, no collaboration, no multi-device sync, and no server-side backup — a
user who clears site data loses unsaved-but-autosaved work; IndexedDB quota is finite and browser
storage can be evicted under pressure, so the app must nag about explicit saves; File System Access
is not universally available, so two save paths must be maintained and tested; the file format is
ours alone until exports to interoperable formats exist; a versioned binary container needs migration
code from day one, which is easy to defer and expensive to retrofit.

**Neutral:** the format choice beyond "zip with a JSON manifest and binary entries" (compression,
entry naming, indexing) is deferred to the persistence spec; imports of glTF/OBJ/STL are additive and
do not change the native format.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Cloud storage with accounts | Needs a backend, money, and trust; contradicts [0001](./0001-static-hosting-github-pages.md). |
| Store the document as a single JSON blob in `localStorage` | Size limits and synchronous access make it unusable for real models; base64 binary data is wasted space. |
| Single flat binary file, no container | Hard to evolve, hard to inspect, and no place to keep per-plugin data isolated. |
| SQLite/WASM in the browser | Excellent durability and querying, but a large dependency for a document store that is written whole and read whole. Reconsider if query-heavy features appear. |
| Always download-based save | Loses the "open, edit, save in place" affordance that makes a desktop tool feel safe. |
| Autosave to a server as a fallback | Not possible and not wanted. |

## Links

- Related: [0001](./0001-static-hosting-github-pages.md), [0005](./0005-plugin-architecture.md),
  [0006](./0006-document-model-and-commands.md), [0008](./0008-units-coordinates-precision.md)
- Invariants: 1–4 in [`../architecture/invariants.md`](../architecture/invariants.md)
