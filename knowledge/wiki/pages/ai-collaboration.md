---
title: AI Collaboration & Fable5 Reform
status: current
last_verified: 2026-07-05
sources:
  - AGENTS.md
  - CLAUDE.md
  - docs/specs/ai-collaboration-reform-fable5.md
  - task.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

## Facts

- The canonical Fable5 work order is
  `docs/specs/ai-collaboration-reform-fable5.md`; it says Fable5 should be
  used for durable maps, checklists, and handoff quality rather than just
  writing lots of code. Source: `docs/specs/ai-collaboration-reform-fable5.md:1-5`.
- The Fable5 prompt requires the agent to first check `git status --short`
  and the latest Handoff in `docs/archive/task-handoffs.md` before changing anything. Source:
  `docs/specs/ai-collaboration-reform-fable5.md:33`.
- The same work order defines five phases: current-state diagnosis, reform
  options, actual durable improvements, dirty-tree review, and verification.
  Source: `docs/specs/ai-collaboration-reform-fable5.md:16-111`.
- `AGENTS.md` now points high-performance model sessions to the Fable5 work
  order and says durable rules, checklists, and Handoff quality should come
  before one-off implementation. Source: `AGENTS.md:14`.
- `AGENTS.md` also says Fable5-style sessions should use high-performance
  models for broad diagnosis, design judgment, checklist creation, Handoff
  improvement, and P0/P1 review; implementation should normally have one
  editor while the other AI acts as a read-only reviewer. Source:
  `AGENTS.md:44-50`.
- `CLAUDE.md` has a Claude Code-facing high-performance model section whose
  entry point is `docs/specs/ai-collaboration-reform-fable5.md`. Source:
  `CLAUDE.md:103-112`.
- Current collaboration identities remain `claude-driver` for Claude Code and
  `codex-reviewer` for Codex on the `eguchi-portfolio` agmsg team. Source:
  `AGENTS.md:32`, `CLAUDE.md:97`.
- The 2026-07-05 Handoff records that the Fable5 reform entry point was added
  as a docs-only change and that existing admin dirty-tree work was outside
  scope; future agents must check the latest `git status --short` because the
  dirty tree may move while agents are working. Source: `task.md:4299-4334`.

## Assumptions

- Future high-performance-model sessions should start from the spec page, not
  from this wiki page, because this wiki is only an index and may become
  stale. Confirm by re-reading `AGENTS.md` and the spec before executing.

## Open Questions

- Whether to add mechanical hooks for the Fable5 reform workflow is undecided.
  The current rule is to improve shared documents and Handoff quality first,
  then consider hooks later.
- Whether the current admin dirty tree should be reviewed by Fable5 is an
  owner decision. If approved, Fable5 should begin in read-only reviewer mode.

## Sources

- `AGENTS.md`
- `CLAUDE.md`
- `docs/specs/ai-collaboration-reform-fable5.md`
- `task.md`
