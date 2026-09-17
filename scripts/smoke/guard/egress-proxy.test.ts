// ブラウザ用の遮断プロキシ（scripts/smoke/egress-proxy.ts）と、先行接続の分類の境界。
// 宛先は .invalid と、分類の境界を確かめる文字列だけ。どこへも転送しない。
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {
  egressVerdict,
  isExpectedPreconnect,
  readEgressProxyHits,
  splitEgressHits,
  startEgressProxy,
  summarizeEgressHits,
  type EgressHit,
} from "../egress-proxy.ts";

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((r) => server.close(r));
  return port;
}

function send(port: number, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => socket.write(text));
    let data = "";
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });
}

test("every attempt is refused with 403, recorded with the running test, and never forwarded", async () => {
  const port = await freePort();
  const proxy = await startEgressProxy(port);
  try {
    // テスト名が付く前の試行は「テスト外」。
    const early = await send(port, "CONNECT fonts.gstatic.com:443 HTTP/1.1\r\nHost: fonts.gstatic.com:443\r\n\r\n");
    const labelled = await fetch(`http://127.0.0.1:${port}/__smoke/label?value=${encodeURIComponent("desktop › a.spec.ts › t")}`);
    assert.equal(labelled.status, 200);
    const plain = await send(port, "GET http://tracker.invalid/pixel HTTP/1.1\r\nHost: tracker.invalid\r\n\r\n");
    const tunnel = await send(port, "CONNECT api.invalid:443 HTTP/1.1\r\nHost: api.invalid:443\r\n\r\n");
    const font = await send(port, "CONNECT fonts.googleapis.com:443 HTTP/1.1\r\nHost: fonts.googleapis.com:443\r\n\r\n");
    for (const response of [early, plain, tunnel, font]) assert.match(response, /^HTTP\/1\.1 403 Forbidden/);

    const listed = (await (await fetch(`http://127.0.0.1:${port}/__smoke/hits`)).json()) as EgressHit[];
    assert.deepEqual(
      listed.map(({ kind, target, label }) => ({ kind, target, label })),
      [
        { kind: "connect", target: "fonts.gstatic.com:443", label: "" },
        { kind: "http", target: "tracker.invalid:80", label: "desktop › a.spec.ts › t" },
        { kind: "connect", target: "api.invalid:443", label: "desktop › a.spec.ts › t" },
        { kind: "connect", target: "fonts.googleapis.com:443", label: "desktop › a.spec.ts › t" },
      ],
    );
    const { preconnect, unexpected } = splitEgressHits(proxy.hits);
    assert.deepEqual(preconnect.map((hit) => hit.target), ["fonts.googleapis.com:443"]);
    assert.deepEqual(unexpected.map((hit) => hit.request), [
      "CONNECT fonts.gstatic.com:443 HTTP/1.1",
      "GET http://tracker.invalid/pixel HTTP/1.1",
      "CONNECT api.invalid:443 HTTP/1.1",
    ]);
    assert.deepEqual(
      summarizeEgressHits(proxy.hits).map(({ kind, target, project, count, specs }) => ({ kind, target, project, count, specs })),
      [
        { kind: "connect", target: "fonts.gstatic.com:443", project: "", count: 1, specs: [] },
        { kind: "http", target: "tracker.invalid:80", project: "desktop", count: 1, specs: ["a.spec.ts"] },
        { kind: "connect", target: "api.invalid:443", project: "desktop", count: 1, specs: ["a.spec.ts"] },
        { kind: "connect", target: "fonts.googleapis.com:443", project: "desktop", count: 1, specs: ["a.spec.ts"] },
      ],
    );
  } finally {
    await proxy.close();
  }
});

const hit = (request: string, overrides: Partial<EgressHit> = {}): EgressHit => {
  const [method, target] = request.split(" ");
  return {
    at: "",
    request,
    kind: method === "CONNECT" ? "connect" : "http",
    target,
    label: "mobile-safari › public-site.spec.ts › t",
    ...overrides,
  };
};

test("only exact font preconnects during a test are counted as expected", () => {
  assert.equal(isExpectedPreconnect(hit("CONNECT fonts.googleapis.com:443 HTTP/1.1")), true);
  assert.equal(isExpectedPreconnect(hit("CONNECT fonts.gstatic.com:443 HTTP/1.1")), true);
  const refused = [
    // CONNECT というだけでは対象にしない。
    hit("CONNECT api.invalid:443 HTTP/1.1"),
    hit("CONNECT www.google-analytics.com:443 HTTP/1.1"),
    // 似た名前・別ポート・別の形は対象にしない。
    hit("CONNECT fonts.googleapis.com.evil.invalid:443 HTTP/1.1"),
    hit("CONNECT evil-fonts.googleapis.com:443 HTTP/1.1"),
    hit("CONNECT fonts.googleapis.com:8443 HTTP/1.1"),
    hit("CONNECT fonts.gstatic.com:443 HTTP/1.0"),
    hit("CONNECT  fonts.gstatic.com:443 HTTP/1.1", { target: "fonts.gstatic.com:443" }),
    // 平文の要求は、宛先が同じでも対象にしない。
    hit("GET http://fonts.googleapis.com/css2 HTTP/1.1", { kind: "http", target: "fonts.googleapis.com:80" }),
    hit("GET https://fonts.gstatic.com/x HTTP/1.1", { kind: "http", target: "fonts.gstatic.com:443" }),
    // テストの外で起きたものは、どのブラウザでも対象にしない。
    hit("CONNECT fonts.gstatic.com:443 HTTP/1.1", { label: "" }),
    // 読めない試行。
    hit("garbage", { kind: "other", target: "" }),
  ];
  for (const attempt of refused) assert.equal(isExpectedPreconnect(attempt), false, attempt.request);
  assert.equal(splitEgressHits(refused).unexpected.length, refused.length);
});

test("a busy proxy port stops the run instead of sharing it", async () => {
  const blocker = net.createServer();
  await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
  const { port } = blocker.address() as net.AddressInfo;
  try {
    await assert.rejects(startEgressProxy(port), /使用中なら止めてから/);
  } finally {
    await new Promise((r) => blocker.close(r));
  }
});

test("the running-test name is cleared, so attempts after it count as unexpected", async () => {
  const port = await freePort();
  const proxy = await startEgressProxy(port);
  const responses: string[] = [];
  const connect = async () =>
    responses.push(await send(port, "CONNECT fonts.gstatic.com:443 HTTP/1.1\r\nHost: fonts.gstatic.com:443\r\n\r\n"));
  const mark = async (query: string) => assert.equal((await fetch(`http://127.0.0.1:${port}/__smoke/label${query}`)).status, 200);
  try {
    await connect(); // 開始前
    await mark(`?value=${encodeURIComponent("desktop › a.spec.ts › first")}`);
    await connect(); // テスト中
    await mark("?value="); // 終了（fixtures.ts が必ず送る）
    await connect(); // テストの間
    await mark(`?value=${encodeURIComponent("desktop › a.spec.ts › second")}`);
    await mark(""); // 値の無い終了も「テスト外」
    await connect(); // 最後のテストの後
    assert.equal(responses.length, 4);
    for (const response of responses) assert.match(response, /^HTTP\/1\.1 403 Forbidden/);
    const hits = await readEgressProxyHits(port);
    assert.deepEqual(hits.map((hit) => hit.label), ["", "desktop › a.spec.ts › first", "", ""]);
    assert.deepEqual(hits.map(isExpectedPreconnect), [false, true, false, false]);
  } finally {
    await proxy.close();
  }
});

test("the run verdict includes server-side blocks and fails closed", () => {
  const during = hit("CONNECT fonts.googleapis.com:443 HTTP/1.1");
  const outside = hit("CONNECT fonts.googleapis.com:443 HTTP/1.1", { label: "" });
  const healthy = { reachable: true as const, status: 200, body: { ok: true, problems: [], blockedConnections: [] } };

  assert.equal(egressVerdict([], healthy).ok, true);
  const fonts = egressVerdict([during], healthy);
  assert.equal(fonts.ok, true);
  assert.equal(fonts.preconnect.length, 1);

  // ブラウザ側が0件でも、サーバー側の遮断が1件あれば失敗（宛先の例外は無い）。
  const note = egressVerdict([], {
    ...healthy,
    body: { ...healthy.body, blockedConnections: [{ host: "note.com", port: "443" }] },
  });
  assert.equal(note.ok, false);
  assert.deepEqual(note.serverBlocked, [{ host: "note.com", port: "443" }]);
  assert.match(note.problems.join("\n"), /サーバー側で外部への接続を止めた: note\.com:443/);

  // 読めない・隔離が崩れた・記録の欄が無い、はどれも成功扱いにしない。
  const failures = [
    egressVerdict([], { reachable: false, error: "fetch failed" }),
    egressVerdict([], { reachable: true, status: 503, body: { ok: false, problems: ["x"], blockedConnections: [] } }),
    egressVerdict([], { reachable: true, status: 200, body: { ok: true } }),
    egressVerdict([], { reachable: true, status: 200, body: null }),
    egressVerdict([outside], healthy),
  ];
  for (const verdict of failures) assert.equal(verdict.ok, false, JSON.stringify(verdict.problems));
  assert.match(failures[4]!.problems[0]!, /テスト外/);
});
