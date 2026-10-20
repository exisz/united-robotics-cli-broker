import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safePath, pack, unpack } from '../bin/files.mjs';
test('reject path traversal from an untrusted server', () => {
  for (const name of ['../secret', '/tmp/secret', 'a/../../secret', 'a\\..\\secret']) assert.throws(() => safePath('/tmp/safe', name));
});
test('file transfer round-trip and no overwrite', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ur-files-')); const source = path.join(root, 'src');
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'x'), 'hello\n');
  const files = await pack(source); const target = path.join(root, 'out'); await unpack(target, files);
  assert.equal(await fs.readFile(path.join(target, 'x'), 'utf8'), 'hello\n');
  await assert.rejects(unpack(target, files));
  await fs.symlink('/etc/passwd', path.join(source, 'link')); await assert.rejects(pack(source));
  await fs.rm(root, { recursive: true });
});
