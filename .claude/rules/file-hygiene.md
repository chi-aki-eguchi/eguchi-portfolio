# File Hygiene

- Root-level Markdown whitelist: `README.md`, `AGENTS.md`, `CLAUDE.md`, `DISTRIBUTION.md`, `task.md`.
- Any other new root-level `.md` file is a rule violation; put active specs under `docs/specs/`, general docs under `docs/`, and temporary drafts under `scratch/`.
- Specs live in `docs/specs/`, one file per spec, updated in place.
- Version history lives in git; never encode it in filenames.
- Spec filenames with `-v2`, `-v3`, `-final`, or `-draft` are banned.
- Finished or retired docs move to `docs/archive/` via `git mv`.
- Do not plainly delete historical docs unless the owner explicitly approves deletion.
- Handoffs are `task.md` entries; standalone `*.handoff.md` files are banned.
- Temporary prompts, drafts, and scratch scripts go in `scratch/`.
- `scratch/` contents are gitignored except `scratch/README.md`.
- Untracked files must be resolved within a few working sessions.
- Resolve untracked files by committing, gitignoring, archiving, moving to `scratch/`, or deleting with approval.
- Each task's Driver checks `git status` before finishing and reports any remaining unrelated dirty files.
