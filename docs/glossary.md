# Glossary

One shared vocabulary. If a term is missing, add it here in the same commit that introduces it.

| Term | Meaning in Gabarito |
|---|---|
| **Document** | The whole user-authored model: entities, materials, units, settings. Serializable and portable. |
| **Entity** | A single addressable object in the document (a group, component instance, face, edge, light, camera). Has a stable ID. |
| **Entity graph** | The parent/child tree of entities. The canonical representation of the document's content. |
| **Command** | A serialisable, invertible operation that mutates the document. The only legal mutation path. |
| **Tool** | A state machine translating pointer/keyboard input into commands. Never touches the document directly. |
| **Plugin** | A module implementing the contract in `plugin-api`, activated at runtime by `plugin-host`. |
| **Feature module** | A plugin with domain meaning: woodworking, lighting design, house building. |
| **Capability** | A named permission a plugin declares so the host can enable, warn, or disable it. |
| **Viewport** | The WebGL canvas and its camera. Owned by `scene`, never by React. |
| **Gizmo / handle** | Interactive on-screen control drawn in the viewport (axis arrow, rotate ring, scale box). |
| **Inference** | Snapping and alignment hints derived from existing geometry (endpoints, midpoints, axes, extensions). |
| **Inference lock** | A user override that pins inference to a direction or reference until released. |
| **B-rep** | Boundary representation: solids described by faces/edges/vertices rather than a triangle soup. |
| **CSG** | Constructive solid geometry: combining solids with union, difference, intersection. |
| **Scene graph** | The Three.js object tree. A *derived view* of the entity graph, rebuilt from it and never authoritative. |
| **Project file** | The portable, versioned container the user saves: `.gabarito`. |
| **Local-first** | The device holds the authoritative copy; the network is optional and never required to edit. |
| **Static bundle** | The build output that GitHub Pages serves. No server code, no runtime secrets. |
| **Spec** | A small plan for one change, in `docs/specs/`. Written before the change, closed after it. |
| **ADR** | Architecture Decision Record: an append-only file in `docs/decisions/` explaining a decision and its alternatives. |
| **Context budget** | The amount of documentation an agent must read to act. Treated as a design constraint, not an afterthought. |
