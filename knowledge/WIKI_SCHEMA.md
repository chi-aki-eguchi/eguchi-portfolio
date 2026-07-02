---
title: Knowledge Wiki Schema
status: current
last_verified: 2026-07-02
sources: []
---

# WIKI_SCHEMA.md

This document defines the rules for `knowledge/wiki/`. Every agent (Claude Code,
Codex, or any future agent) that reads or edits the wiki must follow this
schema.

## Purpose

`knowledge/wiki/` is an **index / compression layer** over this repository's
existing documentation and code. It exists so an AI agent starting a session
can read a handful of short pages and get oriented quickly, instead of
re-reading CLAUDE.md, AGENTS.md, task.md (thousands of lines), every spec file,
and the source tree from scratch every time.

## NOT the source of truth

The wiki summarizes; it does not replace. **Canonical sources always win:**

1. Actual source code
2. CLAUDE.md / AGENTS.md (behavior rules)
3. task.md (implementation work log)
4. Other existing docs/specs (DISTRIBUTION.md, docs/*.md, spec files, etc.)
5. `knowledge/wiki/*` — summary only, may be stale or wrong

If a wiki page conflicts with one of the above, **the source wins**, not the
wiki. Do not "fix" a canonical source to match the wiki. Fix the wiki (or file
an open-issues.md entry) instead.

## Page structure & frontmatter

Every page under `wiki/` (index.md, log.md, and everything in `wiki/pages/`)
must have:

```yaml
---
title: <human-readable title>
status: current | needs-review | stale
last_verified: <YYYY-MM-DD, the date the content was last checked against sources>
sources: [<repo-relative paths, or URLs for external material>]
---
```

Followed immediately by this banner:

```
> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.
```

Then these sections, in order:

- `## Facts` — claims that were verified by actually opening and reading the
  cited source at ingest time.
- `## Assumptions` — reasonable inferences that were **not** directly
  confirmed in a source (e.g., "probably X because Y implies it").
- `## Open Questions` — things that could not be resolved from the sources
  read, contradictions found between sources, or decisions that need an
  owner/maintainer call.
- `## Sources` — the repo-relative paths (or URLs) actually read to write this
  page.

Content specific to the akieguchi.com production deployment (as opposed to the
generic distributable template) should be tagged inline with
**[akieguchi-specific]**.

## Sources conventions

- Cite a repo-relative path, optionally with a line number or section heading,
  e.g. `CLAUDE.md:69-73` or `.claude/rules/db-migrations.md`.
- Never cite a page under `knowledge/wiki/` as a source for another wiki page
  claim — cite the original canonical document/code instead. Wiki pages may
  still *link* to each other for navigation.

## Fact / assumption / open-question separation

- A claim only belongs in `## Facts` if an agent actually opened the file and
  read the relevant lines in the same session that wrote/updated the claim.
- If something is inferred (not stated directly) — even if it's very likely
  true — it belongs in `## Assumptions`, with a one-line note of what would
  confirm it.
- If two sources disagree, or a question genuinely has no answer in the repo,
  it belongs in `## Open Questions` (and, if it's a cross-cutting concern, also
  in `wiki/pages/open-issues.md`).
- Never upgrade an assumption to a fact without re-verifying it against the
  source.

## Ingest procedure

When adding or updating wiki content:

1. Read the canonical source(s) directly (file, code, or — for external
   material — a URL).
2. Summarize into the relevant page's Facts/Assumptions/Open Questions, with a
   citation for each Fact.
3. **Never copy raw canonical docs into `knowledge/raw/`.** `raw/` is for
   future external material only (see `knowledge/raw/README.md`) — it is not a
   mirror of this repo's own docs.
4. Update `last_verified` to the date of this ingest pass.
5. Add an entry to `knowledge/wiki/log.md` describing what changed and why.

## Query guidance for agents

- Start at `wiki/index.md`.
- Open only the page(s) relevant to the current task — the wiki is meant to
  be read selectively, not in full, each session.
- If a page's `status` is `needs-review` or `stale`, treat its Facts with
  extra caution and prefer re-checking the cited canonical source before
  relying on it.

## Lint (manual checklist for now — no scripts in v1)

Before committing a wiki change, manually check:

- [ ] Frontmatter present and complete (title, status, last_verified, sources)
- [ ] Banner present, unmodified
- [ ] Facts / Assumptions / Open Questions / Sources sections all present
- [ ] Every Facts entry has a citation
- [ ] No secrets (see below) appear anywhere in the page
- [ ] `last_verified` updated if content changed
- [ ] `knowledge/wiki/log.md` has a corresponding entry

## Stale handling

Do not silently delete or rewrite history. When a page's content is found to
be outdated:

1. Set its frontmatter `status: stale`.
2. Add an entry to `wiki/pages/open-issues.md` describing what's stale and
   why.
3. Only then update or rewrite the page content, in a separate, later ingest
   pass (or the same pass, but log both steps).

## Contradiction handling

When a wiki page conflicts with a canonical source (or two canonical sources
conflict with each other): the canonical source wins for any actual decision
or code change. Record the contradiction in both `wiki/pages/open-issues.md`
and `wiki/log.md` so it isn't silently lost or re-discovered from scratch
later.

## Agent ownership

Any agent (Claude Code or Codex) may update the wiki. Wiki updates must be
**docs-only commits**, prefixed `docs(wiki):`, and must never be mixed with
implementation changes in the same commit or the same task. See AGENTS.md's
"Shared Knowledge Wiki" section.

## Secrets prohibition

Never copy `.env` values, API keys, tokens, credentials, or private customer
data into any wiki page (or anywhere under `knowledge/`). Reference
*variable names* only (e.g. "S3_ACCESS_KEY_ID exists"), never values.
