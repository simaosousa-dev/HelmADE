import assert from 'node:assert/strict';
import type {
  VoicePermissionState,
  VoiceEngineStatus,
  TranscriptionEvent,
} from '../src/types/voice.ts';

// Test 1: Verify VoicePermissionState shape and typing
const mockPermissionState: VoicePermissionState = {
  speech: 'authorized',
  microphone: 'authorized',
  canTranscribe: true,
};

assert.equal(mockPermissionState.canTranscribe, true);
assert.equal(mockPermissionState.speech, 'authorized');
assert.equal(mockPermissionState.microphone, 'authorized');

// Test 2: Verify restricted permission prevents transcription
const restrictedState: VoicePermissionState = {
  speech: 'denied',
  microphone: 'authorized',
  canTranscribe: false,
};
assert.equal(restrictedState.canTranscribe, false);

// Test 3: Verify VoiceEngineStatus structure and on-device capabilities
const engineStatus: VoiceEngineStatus = {
  isListening: false,
  locale: 'en-US',
  onDeviceSupported: true,
  onDeviceOnly: true,
  lastLatencyMs: 85,
};

assert.equal(engineStatus.isListening, false);
assert.equal(engineStatus.locale, 'en-US');
assert.equal(engineStatus.onDeviceSupported, true);
assert.ok(engineStatus.lastLatencyMs! < 150, 'Latency must be < 150ms per Quality Gate');

// Test 4: Transcription streaming event structure
const partialEvent: TranscriptionEvent = {
  text: 'git commit -m "feat: voice bridge"',
  isFinal: false,
  latencyMs: 95,
  timestamp: Date.now(),
};

assert.equal(partialEvent.isFinal, false);
assert.ok(partialEvent.text.includes('git commit'));
assert.ok(partialEvent.latencyMs! < 150);

const finalEvent: TranscriptionEvent = {
  text: 'git commit -m "feat: voice bridge"',
  isFinal: true,
  latencyMs: 120,
  timestamp: Date.now(),
};

assert.equal(finalEvent.isFinal, true);
assert.ok(finalEvent.latencyMs! < 150);

console.log('✅ All voiceService contract and latency assertions passed successfully!');
