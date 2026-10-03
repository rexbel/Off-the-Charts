# otc-edge

The Cloudflare Worker in front of `offthechart.nextrex.health`.

Every request goes to the Mac first, through the `anchor` Cloudflare Tunnel (`offthechart.nextrex.health` → `localhost:3200`). If the tunnel has no live connector (530), the app isn't answering (502/503), or the Mac doesn't start responding within 8 seconds, the Worker serves the request from a Cloudflare Container running the repo's `Dockerfile`, and skips the Mac for the next 30 seconds. When the Mac comes back, traffic returns to it.

Every response has an `x-otc-origin: mac | cloud` header. Send `x-otc-origin: cloud` to force the cloud copy:

```bash
curl -sI -H "x-otc-origin: cloud" https://offthechart.nextrex.health/api/health
```

## Deploy

Deployed by [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) on every push to `main`:

| Setting | Value |
|---|---|
| Worker name | `otc-edge` |
| Root directory | `deploy/cloudflare` |
| Build command | *(empty)* |
| Deploy command | `npx wrangler deploy` |

Containers need the Workers Paid plan. The container only runs during a handover and sleeps 15 minutes after its last request.

Secrets passed into the container (`npx wrangler secret put <NAME>`): `MONGODB_URI` and `SEED_PASSWORD` (required), `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` (optional). `OFF_THE_CHART_PROVIDER=openai` is a plain var. Without a model key, builds replay the committed cached output.

## The Mac

```bash
deploy/mac/build.sh   # install, build, copy static assets into .next/standalone
deploy/mac/start.sh   # serve on 127.0.0.1:3200, secrets (MONGODB_URI, OPENAI_API_KEY, SEED_PASSWORD) from .env.production.local
```

`deploy/mac/health.nextrex.offthechart.app.plist` runs `start.sh` at login and restarts it if it exits. After a rebuild: `launchctl kickstart -k gui/$(id -u)/health.nextrex.offthechart.app`.

## Limits

- **Shared data.** The Mac and the cloud copy use the same MongoDB Atlas database (`offthechart` on `Cluster0`), so a handover keeps every record. Atlas network access must allow `0.0.0.0/0`, since container egress IPs vary.
- **Writes during a hang.** If a POST times out on the Mac, the Worker returns 503 and doesn't replay it on the cloud copy, since the Mac may have received it.
- **Mismatched builds.** A page loaded from one copy may fail to load a script from the other until it's refreshed.
- **The Mac doesn't update itself.** Pushes redeploy the cloud copy only.

## Local

```bash
npm install
npm run typecheck
npx wrangler dev --enable-containers=false --var MAC_ORIGIN:http://localhost:3200
```

Running the container locally needs Docker.
