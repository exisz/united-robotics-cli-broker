---
name: ur-cli-broker
description: Use the configured ur CLI broker to inspect or manage the authorized Vercel project through the host's official CLI, including deployment details, build/runtime logs and environment variables.
---

# UR CLI broker

Use `ur vercel <official arguments>` when this workspace is configured for the
broker. It runs the host's official Vercel CLI with a server-owned login and a
token-bound project. Do not ask for a Vercel account token.

First verify `ur vercel --version`. For current syntax use
`ur vercel COMMAND --help`. Typical inspection:

```sh
ur vercel list --limit 5
ur vercel inspect skinspiritclinic.com.au
ur vercel inspect skinspiritclinic.com.au --logs
ur vercel logs --since 24h --limit 20 --json
ur vercel env ls
```

Use the caller's actual project/domain when different. Deployment status alone
does not prove an event was delivered; correlate event IDs, timestamps, actual
runtime records and provider receipts. A successful health check does not verify
token access; a real command does.

Honor the user's read-only or change scope. Mutations such as `env add`, deploy,
remove or redeploy require task authorization. Piped input is supported:
`ur vercel env add NAME development < private-value.txt`. Avoid putting secret
values in arguments, output, tickets or source control.

Use `ur --tty vercel ...` for interactive prompts; the client forwards terminal
input, resize, Ctrl+C and live output. Use `--no-tty` for structured automation.
Commands run in fresh linked remote workspaces. To supply files, put client
flags before the tool: `ur --upload ./inputs --download ./new-results vercel ...`.
Upload only required files; downloads require a new destination directory and
may contain secrets. A local path has no remote meaning without upload.

On a dropped connection, do not blindly retry writes. Inspect the result first.
On `BROKER_RESOURCE_BOUNDARY`, report the exact command and redacted error; do
not switch projects, request broader credentials or bypass the host. Some
official commands are account-wide or use resource families not yet covered by
the host's project authorization. Do not claim exhaustive CLI compatibility.

If setup is missing, the operator supplies a broker endpoint and a private token
file. Run `ur broker login --url URL --token-file PATH`. Never paste the token
into a prompt. Configuration defaults to `~/.config/ur-cli-broker/config.json`;
`UR_BROKER_CONFIG` selects a separate project login. If a legacy `ur` binary is
installed, invoke this repository's `bin/ur.mjs` explicitly rather than replacing
the old executable without checking.
