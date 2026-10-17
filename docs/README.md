# docs

Everything an agent needs, in layers. Read only as deep as the task requires.

## Router

| I need to… | Read | Cost |
|---|---|---|
| start any task | [`../AGENTS.md`](../AGENTS.md) | 1 page |
| know how the system fits together | [`architecture/overview.md`](./architecture/overview.md) | 1 page |
| know what must never break | [`architecture/invariants.md`](./architecture/invariants.md) | 1 page |
| know what a module may import | [`architecture/module-boundaries.md`](./architecture/module-boundaries.md) | 1 page |
| add or touch a plugin | [`architecture/plugin-contract.md`](./architecture/plugin-contract.md) | 1 page |
| find why something is the way it is | [`decisions/README.md`](./decisions/README.md), then 1–3 records | index + 1 page each |
| plan a change | [`specs/TEMPLATE.md`](./specs/TEMPLATE.md) + [`guides/writing-a-spec.md`](./guides/writing-a-spec.md) | 2 pages |
| see open or past work | [`specs/README.md`](./specs/README.md) | index |
| write tests | [`guides/testing.md`](./guides/testing.md) | 1 page |
| record a decision | [`guides/writing-an-adr.md`](./guides/writing-an-adr.md) | 1 page |
| work on a domain feature | [`features/README.md`](./features/README.md), then that one feature | index + 1 page |
| work inside one module | that module's `README.md` under [`../packages`](../packages) | 1 page |
| decode vocabulary | [`glossary.md`](./glossary.md) | 1 page |

## Layout

```
docs/
  README.md          you are here — the only file that lists everything
  glossary.md        shared vocabulary, so agents use the same words
  architecture/      how the system is shaped *now*
  decisions/         append-only records of *why*, one decision per file
  specs/             one small plan per change: proposed → accepted → implemented
  guides/            how to do recurring jobs (spec, ADR, tests)
  features/          domain plugins: woodworking, lighting, house building
```

## Rules for this tree

- One concept per file. Roughly ≤90 lines for architecture and decisions, ≤150 for specs.
- Never rewrite an accepted decision — supersede it, so the old reasoning stays searchable.
- A file added here must be added to an index table in the same commit.
- Prefer a new small file over growing an existing one.
