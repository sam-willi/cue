// Cue Tap: Bluetooth vibration cue for the Cue MVP.
//
// Board:  Seeed Studio XIAO nRF52840 (or nRF52840 Sense), Arduino core "Seeed nRF52 mbed-enabled Boards"
// Motor:  3-pin vibration motor module (VCC, GND, IN/SIG) with its own driver transistor
// Wiring: module VCC -> XIAO 3V3, GND -> GND, IN -> D0
//
// The Cue web app connects with Web Bluetooth and writes one rhythm per cue to the pattern
// characteristic: bytes alternate on, off, on, ... in 10 ms units (see src/lib/cue/tapDevice.ts).
// Library: ArduinoBLE (Library Manager).

#include <ArduinoBLE.h>

const int MOTOR_PIN = D0;
const int LED_PIN = LED_BUILTIN;  // XIAO's user LED is active-low

BLEService tapService("7a0b0001-6c75-4e43-8a2c-43554554a501");
BLECharacteristic patternChar("7a0b0002-6c75-4e43-8a2c-43554554a501", BLEWrite | BLEWriteWithoutResponse, 20);

// Rhythm being played: durations in ms, starting with "on".
uint16_t steps[20];
int stepCount = 0;
int stepIndex = -1;  // -1 = idle
unsigned long stepStarted = 0;

void motor(bool on) { digitalWrite(MOTOR_PIN, on ? HIGH : LOW); }

void startPattern(const uint8_t* data, int len) {
  stepCount = len < 20 ? len : 20;
  for (int i = 0; i < stepCount; i++) steps[i] = (uint16_t)data[i] * 10;
  stepIndex = 0;
  stepStarted = millis();
  motor(true);
}

void updatePattern() {
  if (stepIndex < 0) return;
  if (millis() - stepStarted < steps[stepIndex]) return;
  stepIndex++;
  stepStarted = millis();
  if (stepIndex >= stepCount) {
    stepIndex = -1;
    motor(false);
    return;
  }
  motor(stepIndex % 2 == 0);  // even steps are "on", odd steps are "off"
}

void onPattern(BLEDevice, BLECharacteristic c) { startPattern(c.value(), c.valueLength()); }

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  motor(false);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // off

  if (!BLE.begin()) {
    while (true) {  // fast blink = Bluetooth failed to start
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(100);
    }
  }
  BLE.setLocalName("Cue Tap");
  BLE.setDeviceName("Cue Tap");
  BLE.setAdvertisedService(tapService);
  tapService.addCharacteristic(patternChar);
  BLE.addService(tapService);
  patternChar.setEventHandler(BLEWritten, onPattern);
  BLE.advertise();

  const uint8_t hello[] = {8, 8, 8};  // two short buzzes = powered on and advertising
  startPattern(hello, 3);
}

void loop() {
  BLE.poll();
  updatePattern();
  digitalWrite(LED_PIN, BLE.connected() ? LOW : HIGH);  // LED on while the app is connected
}
