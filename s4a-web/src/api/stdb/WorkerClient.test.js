import { describe, expect, it, vi } from 'vitest';
import StdbWorkerClient from './WorkerClient.js';

function setup(file = { slice: () => ({ arrayBuffer: async () => new Uint8Array([1, 2]).buffer }) }) {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  const client = new StdbWorkerClient(file, () => worker);
  return { client, worker };
}

describe('STDB worker client', () => {
  it('serves worker reads using only the requested file slice', async () => {
    const file = { slice: vi.fn(() => ({ arrayBuffer: async () => new Uint8Array([1, 2]).buffer })) };
    const { client, worker } = setup(file);
    await client.handleMessage({ type: 'read', id: 8, start: 64, end: 66 });
    expect(file.slice).toHaveBeenCalledWith(64, 66);
    expect(new Uint8Array(worker.postMessage.mock.calls[0][0].buffer)).toEqual(new Uint8Array([1, 2]));
    client.close();
  });

  it('returns read errors and rejects pending requests when closed', async () => {
    const { client, worker } = setup({ slice: () => ({ arrayBuffer: async () => { throw new Error('read failed'); } }) });
    await client.handleMessage({ type: 'read', id: 1, start: 0, end: 2 });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'readResult', id: 1, error: 'read failed' });
    const pending = client.request('open', { size: 2 });
    client.close();
    await expect(pending).rejects.toThrow('STDB file was closed.');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
