import fs from 'node:fs/promises';
import path from 'node:path';
export function safePath(root, name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || path.isAbsolute(name) || name.split('/').some(p => p === '..' || p === '.')) throw new Error('Invalid remote file path');
  const full = path.resolve(root, name);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('File outside destination');
  return full;
}
export async function pack(root) {
  const files = []; let bytes = 0;
  async function visit(dir) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.ur-broker'].includes(ent.name)) continue;
      const full = path.join(dir, ent.name); const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Upload contains symlink: ${path.relative(root, full)}`);
      if (stat.isDirectory()) { await visit(full); continue; }
      if (!stat.isFile()) continue;
      bytes += stat.size; if (bytes > 32 * 1024 * 1024 || files.length >= 2000) throw new Error('Upload exceeds 32 MiB / 2000 files');
      files.push({ path: path.relative(root, full).split(path.sep).join('/'), data: (await fs.readFile(full)).toString('base64'), executable: !!(stat.mode & 0o111) });
    }
  }
  await visit(root); return files;
}
export async function unpack(root, files) {
  // A new directory prevents overwriting local work or following existing symlinks.
  await fs.mkdir(root, { recursive: false, mode: 0o700 });
  let bytes = 0;
  for (const file of files) {
    const destination = safePath(root, file.path); const data = Buffer.from(file.data, 'base64'); bytes += data.length;
    if (bytes > 32 * 1024 * 1024) throw new Error('Download exceeds 32 MiB');
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fs.writeFile(destination, data, { flag: 'wx', mode: file.executable ? 0o700 : 0o600 });
  }
}
