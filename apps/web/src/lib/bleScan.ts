import type { BleSample } from '@/lib/bleCrowd';

/**
 * Web Bluetooth Scanning (navigator.bluetooth.requestLEScan). Today only
 * Chrome on Android/desktop has it, behind chrome://flags ->
 * "Experimental Web Platform features"; iPhone browsers have no Web Bluetooth.
 * A web page also cannot advertise, so RideGuard phones find each other through
 * the presence API instead, and this scan counts every other advertising device.
 */
interface LEScan { active: boolean; stop: () => void }
interface ScanningBluetooth extends EventTarget {
  requestLEScan?: (o: { acceptAllAdvertisements: boolean; keepRepeatedDevices?: boolean }) => Promise<LEScan>;
}
interface AdvertisementEvent extends Event {
  device: { id: string };
  rssi?: number;
}

const bluetooth = (): ScanningBluetooth | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as unknown as { bluetooth?: ScanningBluetooth }).bluetooth;

export function bleScanSupported(): boolean {
  return typeof bluetooth()?.requestLEScan === 'function';
}

/**
 * Start scanning. Must be called from a user gesture (the Start-ride tap): the
 * browser shows its own permission prompt. Resolves to a stop function.
 */
export async function startBleScan(onSample: (s: BleSample) => void): Promise<() => void> {
  const bt = bluetooth();
  if (!bt?.requestLEScan) throw new Error('Bluetooth scanning is not available in this browser.');
  const scan = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true });
  const handler = (e: Event) => {
    const ev = e as AdvertisementEvent;
    if (typeof ev.rssi === 'number') onSample({ id: ev.device.id, t: Date.now(), rssi: ev.rssi });
  };
  bt.addEventListener('advertisementreceived', handler);
  return () => {
    bt.removeEventListener('advertisementreceived', handler);
    try { scan.stop(); } catch { /* already stopped */ }
  };
}
