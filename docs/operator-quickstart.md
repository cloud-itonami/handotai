# operator quickstart — handotai

**所要 5 分。install も credential も要らない**（§6 を除く）。

この文書の出力は全部 2026-08-13 に実行して貼ったものである。**同じ数字が出ないなら
何かが変わっている** —— それが分かることがこの手順の目的で、飾りではない。

要るもの: `git` / `node`（**v23 以上**。v22.6〜22.x なら §2 の `node` を
`node --experimental-strip-types` にする）/ `curl` / `dig`。
実行環境は node v26.3.0 / git-lfs 3.7.1 / npm 11.12.1 / macOS arm64。

## 1. 取る

```bash
git clone git@github.com:cloud-itonami/handotai.git && cd handotai
git ls-files | wc -l          # → 18
```

west 管理下なら `orgs/cloud-itonami/handotai`。**共有 checkout で編集しない**
（並行セッションの WIP を壊す）。触るなら worktree を切る。

## 2. Worker を動かす（install 不要）

`src/app.ts` は import を 1 つも持たないので、パッケージを1つも入れずに動く。

```bash
cat > /tmp/handotai-drive.mjs <<'EOF'
const app = (await import(process.argv[2])).default;
const hit = async (url, init) => {
  const res = await app.fetch(new Request(url, init), {});
  return `${res.status} ${(await res.text()).slice(0, 96)}`;
};
console.log('GET  /health           ', await hit('https://x/health'));
console.log('GET  /_app/meta        ', await hit('https://x/_app/meta'));
console.log('GET  /xrpc/nope        ', await hit('https://x/xrpc/nope'));
console.log('GET  /nothing          ', await hit('https://x/nothing'));
console.log('PUT  /xrpc/<known>     ', await hit('https://x/xrpc/com.etzhayyim.apps.handotai.wave', {method:'PUT'}));
console.log('POST /xrpc/<known> [1,2]', await hit('https://x/xrpc/com.etzhayyim.apps.handotai.wave', {method:'POST', body:'[1,2]'}));
EOF

node /tmp/handotai-drive.mjs \
  "$PWD/appview/etzhayyim-wasm-handotai-dtyy44cr/src/app.ts"
```

```
GET  /health            200 {"ok":true,"actor":"Handotai","did":"did:web:handotai.etzhayyim.com"}
GET  /_app/meta         200 {"name":"Handotai","did":"did:web:handotai.etzhayyim.com","nanoid":"dtyy44cr","nsids":["com.etzh
GET  /xrpc/nope         404 {"error":"unknown nsid","nsid":"nope"}
GET  /nothing           404 {"error":"not found"}
PUT  /xrpc/<known>      405 {"error":"method_not_allowed"}
POST /xrpc/<known> [1,2] 400 {"error":"JSON body must be an object"}
```

**これがこの repo の実行可能な全部である。** 以下は「動かないことを確かめる」手順。

## 3. 宛先が無いことを確かめる

```bash
for h in handotai.etzhayyim.com dispatcher.etzhayyim.com murakumo.etzhayyim.com \
         atproto.etzhayyim.com; do
  printf '%-28s %s\n' "$h" "$(dig +short "$h" | tr '\n' ' ')"
done
```

```
handotai.etzhayyim.com
dispatcher.etzhayyim.com
murakumo.etzhayyim.com
atproto.etzhayyim.com        172.67.179.128 104.21.51.111
```

**空欄 = NXDOMAIN。** 前 3 つは `CLAUDE.md` / `src/app.ts` / `kotodama.jsonld` が
名指しする host である。唯一解決する 1 つも、この app の NSID を実装していない:

```bash
curl -s -X POST https://atproto.etzhayyim.com/xrpc/com.etzhayyim.apps.handotai.seedArticles \
  -H 'Content-Type: application/json' -d '{"i":0}'
```

```json
{"error":"MethodNotImplemented","message":"com.etzhayyim.apps.handotai.seedArticles is not implemented by this PDS"}
```

（`CLAUDE.md` の seed ループは 80 回これを叩く。80 回とも 501 になる。）

解決する名前は兄弟 repo 側にある —— `curl -s -o /dev/null -w '%{http_code}\n'
https://etzhayyim.com/actor/handotai/did.json` → `200`。

## 4. `component.wasm` が取れないことを確かめる

```bash
W=appview/etzhayyim-wasm-handotai-dtyy44cr/component.wasm
wc -c < $W                       # → 131  (LFS ポインタ)
git lfs pull --include="$W"      # → 1.8s で成功したように終わる
wc -c < $W                       # → 131  ★ 変わらない
```

`.gitattributes` が無いので git-lfs はこのパスを追跡対象と見なさない。**沈黙は成功
ではない。** 実体を直接問う:

```bash
git cat-file blob "HEAD:$W" | git lfs smudge > /tmp/component.wasm ; echo "exit=$?"
wc -c < /tmp/component.wasm
```

```
Downloading <unknown file> (801 KB)
Error downloading object: <unknown file> (51a4d99): Smudge error: Error downloading
<unknown file> (51a4d99…): [51a4d99…] Object does not exist on the server:
[404] Object does not exist on the server
exit=2
     131          ★ 空ファイルではなく「ポインタそのもの」が書き出される
```

LFS batch API に直接訊いても同じ:

```bash
curl -s -X POST https://github.com/cloud-itonami/handotai.git/info/lfs/objects/batch \
  -H 'Accept: application/vnd.git-lfs+json' -H 'Content-Type: application/vnd.git-lfs+json' \
  -d '{"operation":"download","transfers":["basic"],"objects":[{"oid":"51a4d9978bf038baa718c46a0f925857f6d4f6b3ed5312df1b87e2969b0794f7","size":800728}]}'
```

```json
{"objects":[{"oid":"51a4d99…","size":800728,
  "error":{"code":404,"message":"Object does not exist on the server"}}]}
```

⚠ **batch API 自体は HTTP 200 を返す。** 404 は body の中にある。status だけ見ると
「取れる」と読める（実際 1 度そう誤読した）。

## 5. 既知の欠陥を再現する — 上流失敗が 500 になる

```bash
cat > /tmp/handotai-dispatch.mjs <<'EOF'
const app = (await import(process.argv[2])).default;
const env = process.env.DISPATCHER_URL ? { DISPATCHER_URL: process.env.DISPATCHER_URL } : {};
const res = await app.fetch(
  new Request('https://x/xrpc/com.etzhayyim.apps.handotai.wave',
              {method:'POST', body:'{}'}), env);
console.log(res.status, (await res.text()).slice(0, 80));
EOF

APP="$PWD/appview/etzhayyim-wasm-handotai-dtyy44cr/src/app.ts"
node /tmp/handotai-dispatch.mjs "$APP"
```

```
node:internal/modules/run_main:107
    triggerUncaughtException(
[TypeError: fetch failed] {
  [cause]: Error: getaddrinfo ENOTFOUND dispatcher.etzhayyim.com … errno: -3008,
```

**`console.log` に到達しない。** `app.ts` は `return dispatch(…)` を `await` せずに
返すので、rejection が try/catch を素通りする。意図された 400 JSON は返らず、
Worker 上では 500 になる。

DNS が引けないことそれ自体が原因ではない。宛先を実在させると同じ経路が通る:

```bash
DISPATCHER_URL=https://example.com node /tmp/handotai-dispatch.mjs "$APP"
```

```
405 <!doctype html><html lang="en"><head><title>Example Domain</title><link rel="ico
```

上流の応答（ここでは example.com の 405）がそのまま返っている。つまりこの欠陥は
**上流が落ちたときにだけ**現れる —— 一番壊れてほしくない場面である。

## 6. frontend を建てる（2026-08-26: Svelte から ClojureScript へ移行済み）

**`svelte/` は削除した。** frontend は今
`appview/etzhayyim-wasm-handotai-dtyy44cr/cljs/`（shadow-cljs + reagent +
re-frame + jp-go-dds）にある。以下は移行後にこの木で実際に実行した出力である。

```bash
cd appview/etzhayyim-wasm-handotai-dtyy44cr/cljs
npm install
```

```
added 129 packages, and audited 130 packages in 4s
```

```bash
node ~/github/com-junkawasaki/scripts/resource-guard.mjs run build -- amu compile --target wasm32-browser app
```

```
[:app] Build completed. (111 files, 110 compiled, 0 warnings, 12.68s)
```

```bash
node ~/github/com-junkawasaki/scripts/resource-guard.mjs run build -- amu compile --target wasm32-browser test
node out/tests.js
```

```
[:test] Build completed. (112 files, 111 compiled, 0 warnings, 10.00s)

Testing handotai.app-test

Ran 4 tests containing 6 assertions.
0 failures, 0 errors.
```

**建つ。ただし建つのは placeholder である** —— レンダされる文字列は移行前と同じ
`"Vite entry scaffold after SvelteKit cleanup."`（heading は
`etzhayyim-wasm-handotai-dtyy44cr`）。re-frame の `:initialize-db` /
`:heading` / `:message` を経由するようになっただけで、内容は変えていない。

⚠ `amu compile --target wasm32-browser` はこの workspace では**必ず `resource-guard.mjs` 経由で
起動する**（同時 1 本）。他セッションが lock を持っていれば `build is already
running` で exit 2 する —— これは失敗ではなく順番待ちである。

## 7. `npm ci` を試したいなら（appview 側）

```bash
cd appview/etzhayyim-wasm-handotai-dtyy44cr && npm ci --userconfig /dev/null
# → EUNSUPPORTEDPROTOCOL (0.5s)
```

`package.json` と `package-lock.json` は**別の依存集合を宣言している**。lock 側の
`@etzhayyim/magatama-host-sdk` は `file:../../../../40-engine/…` = この repo の外、
既に存在しない monorepo を指す。lock は monorepo 時代の遺物であって、この repo の
現在の manifest ではない。

## 8. この手順が飾りでないことの確認（両方向）

貼られた出力が**実装を読んで出たもの**であることは、実装を壊せば分かる。repo は
変えず、`src/app.ts` のコピーに 1 箇所ずつ変異を入れて §2 の harness に通した
（2026-08-13 実測）:

| 変異 | §2 の出力がどう変わったか |
|---|---|
| allowlist から `…handotai.wave` を 1 行消す | 末尾 2 行が `405`/`400` → **どちらも `404 {"error":"unknown nsid","nsid":"com.etzhayyim.apps.handotai.wave"}`**（消した NSID を名指しする） |
| `readInput` の `Array.isArray` guard を外す | `400` 行が**消え、node が crash する** —— guard を抜けた `[1,2]` が §5 の未 await 経路に落ちるため。2 つの欠陥が繋がっていることが見える |
| `ACTOR.did` を別の値にする | 先頭 2 行が両方その値になる（`/health` と `/_app/meta` が同じ定数を読んでいる） |

3 つとも**壊した場所と、報告が変わった場所が一致する**。無改変では上の表に戻る。

---

**`--userconfig /dev/null` を付けている理由**: このマシンの `~/.npmrc` には
`allowScripts[]` が入っており、それが npm の install に継承されて `EALLOWSCRIPTS` で
落ちることがある。repo の欠陥と自分の設定の欠陥を混ぜないために切っている。
自分の環境で `~/.npmrc` を持たないなら付けなくてよい。
