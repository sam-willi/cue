/**
 * Bluetooth link to a Cue tap device (the Tuesday stand-in for the cuff): a Seeed XIAO nRF52840
 * driving a vibration motor. Firmware: hardware/tap-device/cue_tap/cue_tap.ino.
 *
 * Protocol: one write to the pattern characteristic = one rhythm to play. Bytes alternate
 * on-time, off-time, on-time, ... in units of 10 ms (so 1..255 = 10 ms..2.55 s), the same shape
 * as a navigator.vibrate() pattern. Up to 20 bytes per write.
 */

export const TAP_SERVICE = "7a0b0001-6c75-4e43-8a2c-43554554a501";
export const TAP_PATTERN_CHAR = "7a0b0002-6c75-4e43-8a2c-43554554a501";
export const TAP_DEVICE_NAME = "Cue Tap";
const MAX_BYTES = 20;

/** Encode a navigator.vibrate-style pattern (ms, on/off alternating) for the tap device. */
export function encodePattern(vibrate: number[]): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  for (const ms of vibrate.slice(0, MAX_BYTES)) {
    out.push(Math.max(1, Math.min(255, Math.round(ms / 10))));
  }
  return new Uint8Array(out);
}

// Minimal Web Bluetooth types (not in TypeScript's DOM lib).
interface GattCharacteristic {
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValue(value: BufferSource): Promise<void>;
}
interface GattServer {
  connected: boolean;
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<GattCharacteristic> }>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: GattServer;
}
interface Bluetooth {
  requestDevice(options: {
    filters: { services?: string[]; namePrefix?: string }[];
    optionalServices?: string[];
  }): Promise<BtDevice>;
}

/** True when this browser can talk to Bluetooth devices (Chrome on Android, macOS, Windows, ChromeOS). */
export function bluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export class TapDevice {
  private device: BtDevice | null = null;
  private char: GattCharacteristic | null = null;

  /** Called with the device name on connect and null on disconnect. */
  constructor(private onChange: (name: string | null) => void) {}

  get connected(): boolean {
    return !!this.device?.gatt?.connected && !!this.char;
  }

  /** Must be called from a user gesture (a click); the browser shows its device picker. */
  async connect(): Promise<void> {
    const bt = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
    if (!bt) throw new Error("This browser can't use Bluetooth. Use Chrome on Android or a laptop.");
    const device = await bt.requestDevice({
      filters: [{ services: [TAP_SERVICE] }, { namePrefix: TAP_DEVICE_NAME }],
      optionalServices: [TAP_SERVICE],
    });
    device.addEventListener("gattserverdisconnected", () => {
      this.char = null;
      this.onChange(null);
    });
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(TAP_SERVICE);
    this.char = await service.getCharacteristic(TAP_PATTERN_CHAR);
    this.device = device;
    this.onChange(device.name ?? TAP_DEVICE_NAME);
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
    this.char = null;
    this.onChange(null);
  }

  /** Play a rhythm. Fire-and-forget: a dropped cue must never block or crash the session. */
  play(vibrate: number[]): void {
    const c = this.char;
    if (!c) return;
    const bytes = encodePattern(vibrate);
    const write = c.writeValueWithoutResponse ? c.writeValueWithoutResponse(bytes) : c.writeValue(bytes);
    write.catch(() => undefined);
  }
}
