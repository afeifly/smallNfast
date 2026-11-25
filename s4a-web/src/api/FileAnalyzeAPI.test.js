import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileAnalyzeAPI from './FileAnalyzeAPI';
import CsdAPI from './CsdAPI';
import CsvAPI from './CsvAPI';
import StdbAPI from './StdbAPI';
import * as platform from '../util/platform';

describe('file analysis routing', () => {
  beforeEach(() => {
    FileAnalyzeAPI.reset();
  });

  afterEach(() => {
    FileAnalyzeAPI.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('routes CSD, CSV and STDB to their own readers', async () => {
    const csd = vi.spyOn(CsdAPI, 'loadFile').mockResolvedValue(true);
    const csv = vi.spyOn(CsvAPI, 'loadFromFile').mockResolvedValue(true);
    const stdb = vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    const callback = vi.fn();
    const unsubscribe = FileAnalyzeAPI.onFileLoaded(callback);

    expect(await FileAnalyzeAPI.loadFile({ name: 'first.csd', size: 10 })).toBe(true);
    expect(csd).toHaveBeenCalledOnce();
    expect(await FileAnalyzeAPI.loadFile({ name: 'second.csv', size: 10 })).toBe(true);
    expect(csv).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.isCsvMode()).toBe(true);
    expect(await FileAnalyzeAPI.loadFile({ name: 'third.stdb', size: 10 })).toBe(true);
    expect(stdb).toHaveBeenCalledOnce();
    expect(csd).toHaveBeenCalledOnce();
    expect(csv).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.isStdbMode()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(2);
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    expect(FileAnalyzeAPI.isStdbMode()).toBe(true);
    expect(callback).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('prevents editing and CSD-only operations when an STDB is selected', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    const patch = vi.spyOn(CsdAPI, 'patchSampleValues');
    await FileAnalyzeAPI.loadFile({ name: 'readonly.stdb', size: 10 });
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    await expect(FileAnalyzeAPI.patchSampleValues({ 0: 1 })).rejects.toThrow('read-only STDB');
    expect(patch).not.toHaveBeenCalled();
    expect((await FileAnalyzeAPI.appendFile({ name: 'other.stdb' })).ok).toBe(false);
    expect(FileAnalyzeAPI.needsRepair()).toBeNull();
  });

  it('routes STDB exports to the selected reader', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    const csv = vi.spyOn(StdbAPI, 'exportAllChannelsToCsv').mockResolvedValue();
    const excel = vi.spyOn(StdbAPI, 'exportAllChannelsToExcel').mockResolvedValue();
    await FileAnalyzeAPI.loadFile({ name: 'readonly.stdb', size: 10 });
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    await FileAnalyzeAPI.exportAllChannelsToCsv();
    await FileAnalyzeAPI.exportAllChannelsToExcel();
    expect(csv).toHaveBeenCalledOnce();
    expect(excel).toHaveBeenCalledOnce();
  });

  it('only activates an STDB after selection and cancels safely', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    const select = vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    const callback = vi.fn();
    const unsubscribe = FileAnalyzeAPI.onFileLoaded(callback);
    expect(await FileAnalyzeAPI.loadFile({ name: 'multi.stdb', size: 10 })).toBe(true);
    expect(FileAnalyzeAPI.isStdbMode()).toBe(false);
    await FileAnalyzeAPI.selectStdbSession({ id: 2 });
    expect(select).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.isStdbMode()).toBe(true);
    expect(callback).toHaveBeenCalledOnce();

    await FileAnalyzeAPI.loadFile({ name: 'another.stdb', size: 10 });
    FileAnalyzeAPI.cancelStdbSession();
    await expect(FileAnalyzeAPI.selectStdbSession({ id: 2 })).rejects.toThrow('No STDB session selection');
    unsubscribe();
  });

  it('reads pending recording details without activating the reader', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    const details = { session: { ID: 2 }, channels: [] };
    vi.spyOn(StdbAPI, 'getSessionDetails').mockResolvedValue(details);
    await FileAnalyzeAPI.loadFile({ name: 'multi.stdb', size: 10 });
    expect(await FileAnalyzeAPI.getStdbSessionDetails(2)).toEqual(details);
    expect(FileAnalyzeAPI.isStdbMode()).toBe(false);
    FileAnalyzeAPI.cancelStdbSession();
    await expect(FileAnalyzeAPI.getStdbSessionDetails(2)).rejects.toThrow('No STDB session selection');
  });

  it('appends a selected STDB session and keeps the original session when cancelled', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    const open = vi.spyOn(StdbAPI, 'openAppendSelection').mockResolvedValue();
    const cancel = vi.spyOn(StdbAPI, 'cancelAppendSelection').mockResolvedValue();
    const append = vi.spyOn(StdbAPI, 'appendSession').mockResolvedValue();
    const details = vi.spyOn(StdbAPI, 'getAppendSessionDetails').mockResolvedValue({ session: { ID: 2 }, channels: [] });
    await FileAnalyzeAPI.loadFile({ name: 'first.stdb', size: 10 });
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    await FileAnalyzeAPI.openAppend();
    expect(open).toHaveBeenCalledOnce();
    expect(await FileAnalyzeAPI.getStdbSessionDetails(2)).toEqual({ session: { ID: 2 }, channels: [] });
    expect(details).toHaveBeenCalledWith(2);
    FileAnalyzeAPI.cancelStdbSession();
    expect(cancel).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.isStdbMode()).toBe(true);

    await FileAnalyzeAPI.openAppend();
    const updated = vi.fn();
    window.addEventListener('stdbSessionAppended', updated, { once: true });
    await FileAnalyzeAPI.selectStdbSession({ id: 2 });
    expect(append).toHaveBeenCalledWith({ id: 2 });
    expect(updated).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.isStdbMode()).toBe(true);
  });

  it('rejects details from a cancelled session selection', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    let finish;
    vi.spyOn(StdbAPI, 'getSessionDetails').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await FileAnalyzeAPI.loadFile({ name: 'multi.stdb', size: 10 });
    const request = FileAnalyzeAPI.getStdbSessionDetails(2);
    FileAnalyzeAPI.cancelStdbSession();
    finish({ session: { ID: 2 }, channels: [] });
    await expect(request).rejects.toThrow('cancelled');
  });

  it('ignores a file picker result from a cancelled append selection', async () => {
    vi.spyOn(platform, 'checkIsDesktopHost').mockReturnValue(false);
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    vi.spyOn(StdbAPI, 'openAppendSelection').mockResolvedValue();
    vi.spyOn(StdbAPI, 'cancelAppendSelection').mockResolvedValue();
    let finishPicker;
    vi.stubGlobal('showOpenFilePicker', vi.fn(() => new Promise(resolve => { finishPicker = resolve; })));
    await FileAnalyzeAPI.loadFile({ name: 'first.stdb', size: 10 });
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    await FileAnalyzeAPI.openAppend();
    const picking = FileAnalyzeAPI.openStdbAppendFile();
    FileAnalyzeAPI.cancelStdbSession();
    await FileAnalyzeAPI.openAppend();
    const setFile = vi.spyOn(FileAnalyzeAPI, 'setStdbAppendFile');
    finishPicker([{ getFile: async () => ({ name: 'stale.stdb', size: 10 }) }]);
    await picking;
    expect(setFile).not.toHaveBeenCalled();
  });

  it('does not close a new append dialog when an earlier preparation fails', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    vi.spyOn(StdbAPI, 'loadSession').mockResolvedValue(true);
    let rejectOld;
    vi.spyOn(StdbAPI, 'openAppendSelection')
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce();
    vi.spyOn(StdbAPI, 'cancelAppendSelection').mockResolvedValue();
    const append = vi.spyOn(StdbAPI, 'appendSession').mockResolvedValue();
    await FileAnalyzeAPI.loadFile({ name: 'first.stdb', size: 10 });
    await FileAnalyzeAPI.selectStdbSession({ id: 1 });
    const old = FileAnalyzeAPI.openAppend();
    FileAnalyzeAPI.cancelStdbSession();
    await FileAnalyzeAPI.openAppend();
    rejectOld(new Error('cancelled'));
    await old;
    await FileAnalyzeAPI.selectStdbSession({ id: 2 });
    expect(append).toHaveBeenCalledWith({ id: 2 });
  });

  it('requests only read permission when reopening an STDB handle', async () => {
    vi.spyOn(StdbAPI, 'loadFromFile').mockResolvedValue({ ok: true });
    const handle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockResolvedValue({ name: 'sample.stdb', size: 10 }),
      createWritable: vi.fn()
    };
    expect(await FileAnalyzeAPI.loadFileFromHandle(handle)).toBe(true);
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it('does not let concurrent loads overwrite a reader in progress', async () => {
    let finish;
    vi.spyOn(CsvAPI, 'loadFromFile').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const loading = FileAnalyzeAPI.loadFile({ name: 'first.csv', size: 10 });
    await expect(FileAnalyzeAPI.loadFile({ name: 'second.csv', size: 10 })).rejects.toThrow('already loading');
    finish(true);
    expect(await loading).toBe(true);
  });
});
