#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { pack, unpack } from './files.mjs';
const configPath = process.env.UR_BROKER_CONFIG || path.join(os.homedir(), '.config/ur-cli-broker/config.json');
const help = `ur — remote official CLI client\n\nSetup: ur broker login --url https://HOST --token-file PRIVATE_FILE\n       ur broker status\n       ur broker skill --install\nUsage: ur [--tty|--no-tty] [--upload DIR] [--download NEW_DIR] vercel <official arguments>\n\nOfficial arguments are forwarded unchanged. Ctrl+C and input are forwarded.\nThe server binds your token to a project; credentials and authorization are server-side.\nRequires Node.js 22+. Files are transferred only with explicit --upload/--download.\n`;
try { await main(); } catch (error) { console.error(`ur: ${error.message}`); process.exitCode = 1; }
async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--help') { console.log(help); return; }
  if (args[0] === 'broker') {
    if (args[1] === 'login') {
      const url = args[args.indexOf('--url') + 1]; const file = args[args.indexOf('--token-file') + 1];
      if (!args.includes('--url') || !args.includes('--token-file')) throw new Error(help);
      const endpoint = new URL(url); if (endpoint.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(endpoint.hostname)) throw new Error('HTTPS required');
      const token = (await fs.readFile(file, 'utf8')).trim(); if (!/^urb_[A-Za-z0-9_-]{40,}$/.test(token)) throw new Error('Invalid broker token');
      await fs.mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
      await fs.writeFile(configPath, JSON.stringify({ url: endpoint.origin, token }) + '\n', { mode: 0o600 });
      await fs.chmod(configPath, 0o600); console.log(`Saved broker login to ${configPath}`); return;
    }
    if (args[1] === 'status') {
      const c = await config(); const r = await fetch(c.url + '/health');
      console.log(JSON.stringify({ url: c.url, health: await r.json(), authenticated: 'Run ur vercel --version to verify token' }, null, 2)); return;
    }
    if (args[1] === 'skill') {
      const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/ur-cli-broker/SKILL.md');
      if (!args.includes('--install')) { console.log(source); return; }
      const target = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills/ur-cli-broker');
      await fs.mkdir(target, { recursive: true }); await fs.copyFile(source, path.join(target, 'SKILL.md'));
      console.log(`Installed ${target}/SKILL.md`); return;
    }
    throw new Error(help);
  }
  let tty = !!(process.stdin.isTTY && process.stdout.isTTY); let upload, download;
  while (args[0]?.startsWith('--')) {
    const flag = args.shift();
    if (flag === '--tty') tty = true;
    else if (flag === '--no-tty') tty = false;
    else if (flag === '--upload') upload = args.shift();
    else if (flag === '--download') download = args.shift();
    else throw new Error(`Unknown client flag ${flag}; place official flags after the tool name`);
  }
  const tool = args.shift(); if (!tool) throw new Error('Tool required');
  if (download) { try { await fs.lstat(download); throw new Error('Download directory must not already exist'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  const c = await config(); const url = new URL('/v1/run', c.url); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const files = upload ? await pack(path.resolve(upload)) : [];
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { authorization: `Bearer ${c.token}` }, maxPayload: 48 * 1024 * 1024, perMessageDeflate: false, handshakeTimeout: 20_000 });
    let gotExit = false; let remoteReady = false; let writes = Promise.resolve();
    const send = value => { if (ws.readyState === 1) ws.send(JSON.stringify(value)); };
    const onData = data => { send({ type: 'stdin', data: data.toString('base64') }); if (ws.bufferedAmount > 1024 * 1024) process.stdin.pause(); };
    const drain = setInterval(() => { if (remoteReady && ws.bufferedAmount < 64 * 1024) process.stdin.resume(); }, 25); drain.unref();
    const onEnd = () => send({ type: 'eof' });
    const onInt = () => send({ type: 'signal', signal: 'SIGINT' });
    const onTerm = () => { send({ type: 'signal', signal: 'SIGTERM' }); setTimeout(() => ws.close(), 2500).unref(); };
    const resize = () => send({ type: 'resize', cols: process.stdout.columns || 100, rows: process.stdout.rows || 30 });
    ws.on('open', () => send({ type: 'start', tool, args, tty, files, download: !!download, cols: process.stdout.columns, rows: process.stdout.rows }));
    ws.on('message', data => {
      writes = writes.then(async () => {
        const m = JSON.parse(data);
        if (m.type === 'ready') {
          remoteReady = true;
          if (tty && process.stdin.isTTY) process.stdin.setRawMode(true);
          process.stdin.on('data', onData); process.stdin.on('end', onEnd); process.stdin.resume();
          if (process.stdin.readableEnded) onEnd();
        } else if (m.type === 'stdout' || m.type === 'stderr') {
          const stream = m.type === 'stdout' ? process.stdout : process.stderr;
          if (!stream.write(Buffer.from(m.data, 'base64'))) await new Promise(r => stream.once('drain', r));
        } else if (m.type === 'files' && download) await unpack(path.resolve(download), m.files);
        else if (m.type === 'error') { process.stderr.write(`ur: ${m.message}\n`); process.exitCode = 1; }
        else if (m.type === 'exit') { gotExit = true; process.exitCode = m.code ?? 1; }
      }).catch(error => { reject(error); ws.close(); });
    });
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm); process.stdout.on('resize', resize);
    ws.on('error', reject);
    ws.on('close', async () => {
      clearInterval(drain); await writes;
      if (tty && process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.off('data', onData); process.stdin.off('end', onEnd); process.stdin.pause();
      process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); process.stdout.off('resize', resize);
      if (!gotExit) reject(new Error('Connection ended without command exit status; do not automatically retry a write command'));
      else resolve();
    });
  });
}
async function config() {
  if (process.env.UR_BROKER_URL && process.env.UR_BROKER_TOKEN) return { url: process.env.UR_BROKER_URL, token: process.env.UR_BROKER_TOKEN };
  return JSON.parse(await fs.readFile(configPath, 'utf8'));
}
