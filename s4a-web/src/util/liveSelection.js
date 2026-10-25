/**
 * Shared live channel selection.
 *
 * The live Graphic View owns the selection (stock ChannelList + chart
 * controller) and publishes the selected channel ids here; the live Table
 * View follows, showing exactly the channels checked in the graphic view.
 */

let selectedIds = [];
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try {
      fn(selectedIds);
    } catch (e) {
      console.warn('[liveSelection] listener error:', e);
    }
  }
}

/** Replace the selection (ids in selection order — main channel first). */
export function setLiveSelection(ids) {
  selectedIds = Array.isArray(ids) ? [...ids] : [];
  notify();
}

/** @returns {number[]} the currently selected channel ids (may be empty). */
export function getLiveSelection() {
  return [...selectedIds];
}

/** Subscribe to selection changes. Returns an unsubscribe function. */
export function subscribeLiveSelection(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Drop the selection (e.g. device disconnected). */
export function clearLiveSelection() {
  selectedIds = [];
  notify();
}
