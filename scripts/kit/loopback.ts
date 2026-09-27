// Laboratory-only bind override, used also when checking an older immutable release.
const original = Bun.serve.bind(Bun);
Bun.serve = ((options: Parameters<typeof Bun.serve>[0]) => original({ ...options, hostname: '127.0.0.1' } as Parameters<typeof Bun.serve>[0])) as typeof Bun.serve;
