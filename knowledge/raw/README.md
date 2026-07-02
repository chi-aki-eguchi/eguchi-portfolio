# raw/

This directory is a **read-only drop zone for future external source
material** — things like a PDF a client sends, a pasted competitor analysis,
or a third-party spec that doesn't already live in this repo.

Rules:

- **Existing repo docs must never be copied here.** CLAUDE.md, AGENTS.md,
  task.md, DISTRIBUTION.md, docs/*.md, spec files, etc. already live in the
  repo — they are canonical on their own and should be *cited*, not
  duplicated, from `wiki/pages/*.md`.
- Ingest (writing a wiki page from a source) never modifies files in `raw/` —
  it only reads them and writes a summary into `wiki/pages/`.
- Nothing has been placed here yet as of this wiki's bootstrap
  (2026-07-02). This file exists so the convention is documented before the
  directory is ever used.

See `../WIKI_SCHEMA.md` for the full ingest procedure.
