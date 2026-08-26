# handotai 半導体 — appview の**実装側**（descriptor は `handotai-actor`）

**ここにあるのは 1 本の依存ゼロな Cloudflare Worker と、Svelte から移行した
ClojureScript（shadow-cljs + reagent + re-frame + jp-go-dds）の frontend scaffold
である。半導体の記事を集めるものは、この repo には無い。**

`handotai`（半導体）は主題を言うが、**この repo が何であるか**を言わない。しかも west
には `handotai` という名前の repo が**もう 1 つ**ある。だから最初に名乗る:

| west path | これは何か | 中身 |
|---|---|---|
| `orgs/cloud-itonami/handotai` ← **ここ** | **実装**（`README.edn` の `:kind :app`） | `appview/etzhayyim-wasm-handotai-dtyy44cr/` — Worker 1 本 + ClojureScript frontend scaffold + LFS ポインタ |
| `orgs/cloud-itonami/handotai-actor` | actor の **descriptor / identity 面** | `actor-manifest.jsonld`・`.well-known/did.json`・`kotoba.app.edn` |

出自が違う。ここは etzhayyim monorepo の `60-apps/` 由来、兄弟は `20-actors/` 由来。
旧 GitHub 名は**両方生きていて別々の場所へ行く** — `etzhayyim/com-etzhayyim-app-handotai`
→ ここ、`etzhayyim/com-etzhayyim-handotai` → `handotai-actor`（2026-08-13 実測）。
`README.edn` / `migration.edn` が名乗る `com-etzhayyim-app-handotai` は前者なので、
**この repo の 3 つの名前は食い違っていない**（移送先が etzhayyim から cloud-itonami へ
変わっただけ）。

## 実際に動くもの（1 つだけ）

`appview/etzhayyim-wasm-handotai-dtyy44cr/src/app.ts`（4,241 B）は **import を 1 つも
持たない** Worker で、`npm install` 抜きで今すぐ動く。23 の NSID を allowlist し、
知らない NSID を 404 で落とし、残りを `DISPATCHER_URL` へ転送する薄い proxy である。

```
GET  /health            200 {"ok":true,"actor":"Handotai","did":"did:web:handotai.etzhayyim.com"}
GET  /_app/meta         200 {…,"nsids":[…23 件…]}
GET  /xrpc/nope         404 {"error":"unknown nsid","nsid":"nope"}
PUT  /xrpc/<known>      405 {"error":"method_not_allowed"}
POST /xrpc/<known> [1,2] 400 {"error":"JSON body must be an object"}
GET  /nothing           404 {"error":"not found"}
```

**この 6 行は実行して得たものである。** 手順は
[`docs/operator-quickstart.md`](docs/operator-quickstart.md)（node だけ、install 不要）。

## 動かないもの（2026-08-13 実測）

**この repo からデプロイはできない。** wrangler 設定（`wrangler.toml` / `.jsonc`）が
無く、`CLAUDE.md` が書く `etzhayyim build` / `etzhayyim deploy` の CLI も PATH に無い。

宛先も無い:

| 名乗り | どこから | 実測 |
|---|---|---|
| `handotai.etzhayyim.com` | `CLAUDE.md` の health check、`app.ts` の DID | **NXDOMAIN** |
| `dispatcher.etzhayyim.com` | `app.ts` の `DISPATCHER_URL` 既定値 | **NXDOMAIN** |
| `murakumo.etzhayyim.com` | `kotodama.jsonld` の `MURAKUMO_URL` | **NXDOMAIN** |
| `atproto.etzhayyim.com` | `CLAUDE.md` の seed 手順 | 解決する。ただし当 app の NSID は **501 MethodNotImplemented** |
| `did:web:etzhayyim.com:actor:handotai` | 兄弟 repo の `did.json` | **200**（唯一解決する名前。ここの DID ではない） |

つまり `/xrpc/*` は転送先を持たない。そして転送先が落ちたとき、この Worker は
**500 を返す**（下記の欠陥）。

**`component.wasm` は 131 B の git-lfs ポインタで、実体は取得できない。** oid
`51a4d99…`（800,728 B）を LFS batch API に問うと `{"code":404,"message":"Object does not
exist on the server"}` が返る。加えて `.gitattributes` が無いので
`git lfs pull --include=<path>` は**静かに何もしない**（2 秒ほどで成功したように終わり、
ファイルは 131 B のまま）。ビルド済み component はこの repo からは復元できない。

**npm の manifest 2 つは互いに別のことを言っている。** `package.json` は
`@etzhayyim/kotodama-host-sdk`（`workspace:*`）1 本、`package-lock.json` は
`@bytecodealliance/preview2-shim` + `@etzhayyim/magatama-host-sdk`
（`file:../../../../40-engine/…` = 消えた monorepo への相対パス）+ `esbuild`。
`npm ci` は 0.5s で `EUNSUPPORTEDPROTOCOL` を返す。`@etzhayyim/*` は 3 つとも
npm registry で **404**。

## `CLAUDE.md` を仕様として読まないこと

`CLAUDE.md`（9,093 B）は W Protocol event stream・yata SQL・OTEL→B2・80 本の seed 記事・
75 対の静的翻訳・SvelteKit SSR を持つシステムを記述する。**この repo の 18 tracked
files にそれらは無い。** 名指しで不在:

`svelte.config.js` / `+page.server.ts` / `server/connect.ts` / `svelte/src/lib/translations.ts` /
`wrangler.toml` / `wasm/` ディレクトリ（実際は `appview/`）。`kotodama.jsonld` の
`component.path: /wasm/component.wasm` も同じずれ。

**2026-08-26 実測: `svelte/` は削除し、同じ内容を `cljs/` へ移行した**
（Svelte 5 + Vite 6 → ClojureScript(shadow-cljs) + reagent + re-frame + jp-go-dds）。
`cljs/` が実際に描くのは
**`etzhayyim-wasm-handotai-dtyy44cr` / "Vite entry scaffold after SvelteKit cleanup."**
という同じ 2 行の placeholder である（`src/handotai/app.cljs`。移行は忠実な port で、
機能を足していない）。tailwind と postcss の設定は `svelte/` と共に消えた ——
`@tailwind` ディレクティブも CSS import も持たない inert な設定だったので、失うものは
無い。CSS は jp-go-dds の vendored `dds.css` に代わった。

冒頭の `DEPRECATED` 行は正しい方向を指している —— identity は `handotai-actor` が持つ。

## Frontend

```bash
cd appview/etzhayyim-wasm-handotai-dtyy44cr/cljs
npm install
npx shadow-cljs compile app      # -> public/js/, served alongside public/index.html
npx shadow-cljs compile test && node out/tests.js   # cljs.test over the re-frame event/sub logic
```

ClojureScript（shadow-cljs）+ reagent 1.2.0 + re-frame 1.4.3、`jp-go-dds.core`
（デジタル庁デザインシステム）hiccup で描画 —— このワークスペースの base design
system。`public/index.html` の inline CSS は `jp-go-dds.page/->page` で一度生成した
ものである。旧 Svelte 5 + Vite 6 frontend（`appview/etzhayyim-wasm-handotai-dtyy44cr/svelte`、
削除済み）からの移行。

## 既知の欠陥 — 上流失敗が 500 になる

`src/app.ts` の `dispatch` は `await` されずに返される:

```ts
try {
  const input = await readInput(request);
  return dispatch(env, nsid, input, request);   // ← await が無い
} catch (err) { … 400 … }
```

promise を返しているので、**転送先の失敗は try/catch を素通りする**。実測: 有効な
NSID に POST すると `TypeError: fetch failed` が uncaught で抜け、Worker では 500 に
なる（意図された JSON エラーは返らない）。再現手順は quickstart §5。

**直していない。** 1 語の修正だが、回帰テストを持たない修正は次に同じ形で戻る。
`test/` を持つ周の仕事として残す。

## descriptor が名乗る取り込み口は生きている

`kotodama.jsonld` の 6 本の RSS は 2026-08-13 時点で**全部 200**（PC Watch 16.8 KB /
ITmedia 29.6 KB / Publickey 27.6 KB / SemiAnalysis 899 KB / Semiconductor Engineering
164 KB / EE Times 23.8 KB）。**ただしこの repo にそれを読むコードは無い。** 宣言と
実装が別の場所にあることの、これも 1 つの現れである。

## 出所

etzhayyim monorepo `60-apps/etzhayyim-project-handotai` からの抽出
（`migration.edn`: revision `6fd297f3`, tree `60cd0191`, 16 tracked files / 36,851 B）。
Apache License 2.0 + etzhayyim Charter Compliance Rider v3.1（`NOTICE`。ただし
`CHARTER-RIDER.md` も `LICENSE` もこの repo には無い）。
