/** Storage abstraction between the project model and the host.
 * A desktop or server host works with folders directly; a browser host may
 * only offer a folder picker (File System Access) or nothing at all, in
 * which case the app falls back to bundle export/import.
 */
import { ProjectConflictError } from './project';

export interface StoredFile {
  content: string;
  /** Opaque revision token (etag, mtime/size, or content hash). */
  revision: string;
}

export interface StorageProvider {
  readonly kind: string;
  readonly canWriteDirectly: boolean;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<StoredFile>;
  /** Pass the last-seen revision to detect external changes; `null` writes
   * unconditionally (new files, Save As, or post-conflict overwrite). */
  writeFile(path: string, content: string, expectedRevision?: string | null): Promise<string>;
}

export function hashRevision(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) hash = ((hash << 5) + hash + content.charCodeAt(i)) >>> 0;
  return `hash-${hash.toString(16)}`;
}

/** In-memory provider: tests, previews, and hosts without file access. */
export class MemoryProjectStorage implements StorageProvider {
  readonly kind = 'memory';
  readonly canWriteDirectly = true;
  private files = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) this.files.set(path, content);
  }

  /** Simulate another program editing the project behind our back. */
  tamper(path: string, content: string): void {
    this.files.set(path, content);
  }

  async listFiles(): Promise<string[]> {
    return [...this.files.keys()].sort();
  }

  async readFile(path: string): Promise<StoredFile> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return { content, revision: hashRevision(content) };
  }

  async writeFile(path: string, content: string, expectedRevision: string | null = null): Promise<string> {
    const current = this.files.get(path);
    const currentRevision = current === undefined ? '' : hashRevision(current);
    if (expectedRevision !== null && currentRevision !== expectedRevision) {
      throw new ProjectConflictError(path, currentRevision);
    }
    this.files.set(path, content);
    return hashRevision(content);
  }
}


// Extra project files may be binary. Keep their bytes losslessly in the
// string-based snapshot/bundle format; escape text that starts with the marker.
const FILE_ENCODING_MARKER = '\u0000NCTGraphite:file:';
export function encodeStoredBytes(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return text.startsWith(FILE_ENCODING_MARKER) ? `${FILE_ENCODING_MARKER}text:${text}` : text;
  } catch {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `${FILE_ENCODING_MARKER}base64:${btoa(binary)}`;
  }
}
export function decodeStoredBytes(content: string): Uint8Array {
  if (content.startsWith(`${FILE_ENCODING_MARKER}text:`)) return new TextEncoder().encode(content.slice(`${FILE_ENCODING_MARKER}text:`.length));
  if (content.startsWith(`${FILE_ENCODING_MARKER}base64:`)) {
    const binary = atob(content.slice(`${FILE_ENCODING_MARKER}base64:`.length));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }
  return new TextEncoder().encode(content);
}

type PickerHost = {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
};

export function canPickFolders(host: PickerHost = globalThis as unknown as PickerHost): boolean {
  return typeof host.showDirectoryPicker === 'function';
}

interface DirectoryEntries {
  values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

async function collectPaths(dir: FileSystemDirectoryHandle, prefix: string, out: string[]): Promise<void> {
  const entries = (dir as unknown as DirectoryEntries).values();
  for await (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'file') out.push(path);
    else await collectPaths(entry as FileSystemDirectoryHandle, path, out);
  }
}

async function resolveDir(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').slice(0, -1);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Folder-backed provider over the File System Access API. */
export class FileSystemProjectStorage implements StorageProvider {
  readonly kind = 'file-system';
  readonly canWriteDirectly = true;

  constructor(private dir: FileSystemDirectoryHandle) {}

  async listFiles(): Promise<string[]> {
    const out: string[] = [];
    await collectPaths(this.dir, '', out);
    return out.sort();
  }

  async readFile(path: string): Promise<StoredFile> {
    let handle: FileSystemFileHandle;
    try {
      handle = await (await resolveDir(this.dir, path, false)).getFileHandle(fileName(path));
    } catch {
      throw new Error(`File not found: ${path}`);
    }
    const file = await handle.getFile();
    return { content: encodeStoredBytes(new Uint8Array(await file.arrayBuffer())), revision: `${file.lastModified}:${file.size}` };
  }

  async writeFile(path: string, content: string, expectedRevision: string | null = null): Promise<string> {
    if (expectedRevision !== null) {
      let currentRevision: string | null = null;
      try {
        currentRevision = (await this.readFile(path)).revision;
      } catch {
        currentRevision = null;
      }
      const seenEmpty = expectedRevision === '' || expectedRevision === undefined;
      if ((currentRevision ?? '') !== (seenEmpty ? '' : expectedRevision)) {
        throw new ProjectConflictError(path, currentRevision ?? '');
      }
    }
    const dir = await resolveDir(this.dir, path, true);
    const handle = await dir.getFileHandle(fileName(path), { create: true });
    const writable = await handle.createWritable();
    await writable.write(new Blob([decodeStoredBytes(content) as Uint8Array<ArrayBuffer>]));
    await writable.close();
    return (await this.readFile(path)).revision;
  }
}
