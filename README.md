# United Robotics CLI Broker

Open-source `ur` client for running an official CLI on a trusted broker host.
Currently the host registers Vercel. Use official Vercel arguments after
`ur vercel`; the host supplies its own login and your token's project binding.

## Install

Requires Node.js 22 or newer and npm. No Vercel account token or local Vercel
installation is required.

```sh
npm install -g https://github.com/exisz/united-robotics-cli-broker/archive/refs/tags/v0.1.0.tar.gz
```

If another package already owns the `ur` command, do not force-overwrite it.
Install this client in its own directory and invoke its local executable:

```sh
git clone https://github.com/exisz/united-robotics-cli-broker.git
cd united-robotics-cli-broker
git checkout v0.1.0
npm ci
node bin/ur.mjs --help
```

In that case replace `ur` below with `node /absolute/path/to/bin/ur.mjs`.

## Configure once

Save the token provided separately by your operator in a private local file.
Do not commit it or paste it into an issue, prompt, or command-line argument.

```sh
ur broker login --url https://cli-broker.unitedrobotics.app --token-file /path/to/private-token.txt
ur broker skill --install
ur vercel --version
```

Configuration is stored in `~/.config/ur-cli-broker/config.json` with owner-only
permissions. `UR_BROKER_CONFIG` selects a different config file, useful when
working with several projects. CI can use `UR_BROKER_URL` and `UR_BROKER_TOKEN`
from its secret store. `ur broker status` checks service health; an actual command
also verifies authentication.

## Use official Vercel commands

```sh
ur vercel list --limit 5
ur vercel inspect skinspiritclinic.com.au
ur vercel inspect skinspiritclinic.com.au --logs
ur vercel logs --since 24h --limit 20 --json
ur vercel logs --follow
ur vercel env ls
ur vercel project inspect skinspiritclinic.com.au
ur vercel api /v9/projects/skinspiritclinic.com.au
ur vercel env add EXAMPLE development < /path/to/value.txt
```

Use `ur vercel help` or `ur vercel COMMAND --help` for the installed official
CLI's syntax. A broker token does not grant permission to modify something the
human has only asked you to inspect.

The client forwards arguments, stdin, stdout, stderr and exit status. TTY mode
is automatic in an interactive terminal. Use `--tty` or `--no-tty` before
`vercel` to override it. Resize and Ctrl+C are forwarded. A connection loss is
reported as an error, never automatically retried: a write may already have
completed, so read back before retrying.

## Files

Every command runs in a fresh remote workspace linked to your authorized
project. Your computer's paths are not the host's paths. Transfer files
explicitly:

```sh
ur --upload ./inputs --download ./new-results vercel env pull .env.development --environment development
```

`--upload` sends regular files in that directory, including dotfiles except
`.git`, `node_modules`, and `.ur-broker`. Review the directory before sending it;
include only the files required by your command. Symlinks are rejected. The
server overwrites `.vercel/project.json` with its authorized binding.
`--download` saves the resulting remote workspace into a **new** local directory
and never overwrites existing work. Files are capped at 32 MiB / 2,000 entries
per run. Downloaded environment files can contain secrets: keep them private.

## Authorization and compatibility

This is command transport, not a reimplementation of each Vercel command. The
host executes its installed official Vercel CLI. It enforces project ownership
at the resource boundary and isolates the process from host files and direct
network access. Upstream Vercel credentials never reach the client or child CLI.

Project-scoped operations are eligible for forwarding regardless of read/write
method. Account-wide actions (tokens, billing, other projects/teams) are outside
a project token's authority. A new Vercel resource family that the host cannot
prove belongs to your project fails with `BROKER_RESOURCE_BOUNDARY`; report the
command and redacted error to the operator. Do not claim every Vercel feature is
verified just because its command is forwarded. Local development servers,
package builds needing additional network services, and arbitrary browser/network
tools are not covered by the current host's acceptance tests.

The host computer and its Vercel login must remain available. A working broker
does not override Vercel's deployment-author permissions or recover logs beyond
Vercel's retention period.

## Codex skill

`ur broker skill --install` installs [the bundled skill](skills/ur-cli-broker/SKILL.md)
into `$CODEX_HOME/skills/ur-cli-broker` (default `~/.codex/skills`). Start a fresh
Codex turn/session if the skill catalog has not refreshed. No secret is embedded
in the skill. On this operator's shared-skills host, use the established
OpenClaw/Codex/Copilot shared-source links instead of making duplicate copies.

## Development

```sh
npm ci
npm test
```

License: MIT. Host implementation is maintained separately in
`united-robotics-cli-broker-host`; the client has no dependency on legacy UR,
President databases, or World.
