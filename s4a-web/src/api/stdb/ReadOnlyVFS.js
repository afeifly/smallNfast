import * as VFS from 'wa-sqlite/src/VFS.js';

export default class ReadOnlyVFS extends VFS.Base {
  name = 'stdb-readonly';

  constructor(file) {
    super();
    this.file = file;
    this.error = null;
  }

  xOpen(name, fileId, flags, outFlags) {
    if (!(flags & VFS.SQLITE_OPEN_MAIN_DB)) return VFS.SQLITE_CANTOPEN;
    outFlags.setInt32(0, VFS.SQLITE_OPEN_READONLY, true);
    return VFS.SQLITE_OK;
  }

  xClose() {
    return VFS.SQLITE_OK;
  }

  xRead(fileId, data, offset) {
    return this.handleAsync(async () => {
      try {
        const bytes = new Uint8Array(await this.file.slice(offset + 64, offset + 64 + data.length).arrayBuffer());
        data.set(bytes);
        if (bytes.length < data.length) {
          data.fill(0, bytes.length);
          return VFS.SQLITE_IOERR_SHORT_READ;
        }
        return VFS.SQLITE_OK;
      } catch (error) {
        this.error = error;
        return VFS.SQLITE_IOERR_READ;
      }
    });
  }

  xFileSize(fileId, size) {
    size.setBigInt64(0, BigInt(this.file.size - 64), true);
    return VFS.SQLITE_OK;
  }

  xAccess(name, flags, result) {
    result.setInt32(0, 0, true);
    return VFS.SQLITE_OK;
  }
}
