/* PixelQuest – Sync Phone <-> Watch (preview).
 * Dans la preview, "phone" et "watch" partagent un même état JS. Pour
 * fidèlement simuler la latence du Data Layer Wear OS, on relaie les
 * mutations via un EventTarget avec un petit delay et un statut visuel.
 *
 * Sur Android, ce module sera remplacé par un wrapper Kotlin qui utilise
 * la `Wearable.DataClient` API (cf. android/shared/sync/SyncBus.kt).
 */
(function (global) {
  'use strict';

  const bus = new EventTarget();
  let lastSync = Date.now();
  let pending = 0;

  function emit(type, payload) {
    pending++;
    setTimeout(() => {
      pending = Math.max(0, pending - 1);
      lastSync = Date.now();
      bus.dispatchEvent(new CustomEvent(type, { detail: payload }));
      bus.dispatchEvent(new CustomEvent('synced', { detail: { type, ts: lastSync } }));
    }, 80);
  }

  function on(type, cb)   { bus.addEventListener(type, cb); }
  function off(type, cb)  { bus.removeEventListener(type, cb); }
  function status() { return { pending, lastSync }; }

  global.PixelSync = { emit, on, off, status };
})(typeof window !== 'undefined' ? window : globalThis);
