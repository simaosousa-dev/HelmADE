#import <Foundation/Foundation.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>
#include "speech_bridge.h"

static AVAudioEngine *s_audioEngine = nil;
static SFSpeechRecognizer *s_speechRecognizer = nil;
static SFSpeechAudioBufferRecognitionRequest *s_recognitionRequest = nil;
static SFSpeechRecognitionTask *s_recognitionTask = nil;
static BOOL s_isRecognizing = NO;
static NSLock *s_lock = nil;

static HelmVoiceTranscriptionCallback s_transcriptionCb = NULL;
static HelmVoiceErrorCallback s_errorCb = NULL;
static void *s_userData = NULL;

__attribute__((constructor))
static void helmvoice_init(void) {
    s_lock = [[NSLock alloc] init];
}

HelmVoicePermissionStatus helmvoice_check_speech_permission(void) {
    SFSpeechRecognizerAuthorizationStatus status = [SFSpeechRecognizer authorizationStatus];
    switch (status) {
        case SFSpeechRecognizerAuthorizationStatusNotDetermined: return HELMVOICE_PERM_NOT_DETERMINED;
        case SFSpeechRecognizerAuthorizationStatusDenied: return HELMVOICE_PERM_DENIED;
        case SFSpeechRecognizerAuthorizationStatusRestricted: return HELMVOICE_PERM_RESTRICTED;
        case SFSpeechRecognizerAuthorizationStatusAuthorized: return HELMVOICE_PERM_AUTHORIZED;
        default: return HELMVOICE_PERM_NOT_DETERMINED;
    }
}

HelmVoicePermissionStatus helmvoice_check_microphone_permission(void) {
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    switch (status) {
        case AVAuthorizationStatusNotDetermined: return HELMVOICE_PERM_NOT_DETERMINED;
        case AVAuthorizationStatusDenied: return HELMVOICE_PERM_DENIED;
        case AVAuthorizationStatusRestricted: return HELMVOICE_PERM_RESTRICTED;
        case AVAuthorizationStatusAuthorized: return HELMVOICE_PERM_AUTHORIZED;
        default: return HELMVOICE_PERM_NOT_DETERMINED;
    }
}

void helmvoice_request_speech_permission(HelmVoicePermissionCallback callback, void *user_data) {
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        HelmVoicePermissionStatus perm;
        switch (status) {
            case SFSpeechRecognizerAuthorizationStatusNotDetermined: perm = HELMVOICE_PERM_NOT_DETERMINED; break;
            case SFSpeechRecognizerAuthorizationStatusDenied: perm = HELMVOICE_PERM_DENIED; break;
            case SFSpeechRecognizerAuthorizationStatusRestricted: perm = HELMVOICE_PERM_RESTRICTED; break;
            case SFSpeechRecognizerAuthorizationStatusAuthorized: perm = HELMVOICE_PERM_AUTHORIZED; break;
            default: perm = HELMVOICE_PERM_NOT_DETERMINED; break;
        }
        if (callback) {
            callback(perm, user_data);
        }
    }];
}

void helmvoice_request_microphone_permission(HelmVoicePermissionCallback callback, void *user_data) {
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
        HelmVoicePermissionStatus perm = granted ? HELMVOICE_PERM_AUTHORIZED : HELMVOICE_PERM_DENIED;
        if (callback) {
            callback(perm, user_data);
        }
    }];
}

bool helmvoice_is_on_device_supported(const char *locale_identifier) {
    @autoreleasepool {
        NSLocale *locale = nil;
        if (locale_identifier && strlen(locale_identifier) > 0) {
            locale = [NSLocale localeWithLocaleIdentifier:[NSString stringWithUTF8String:locale_identifier]];
        } else {
            locale = [NSLocale currentLocale];
        }
        SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
        if (!recognizer) {
            return false;
        }
        if (@available(macOS 10.15, *)) {
            return (bool)recognizer.supportsOnDeviceRecognition;
        }
        return false;
    }
}

int32_t helmvoice_start_recognition(
    const char *locale_identifier,
    bool on_device_only,
    HelmVoiceTranscriptionCallback on_transcription,
    HelmVoiceErrorCallback on_error,
    void *user_data
) {
    [s_lock lock];
    if (s_isRecognizing) {
        [s_lock unlock];
        return 1; // Already running
    }

    @autoreleasepool {
        s_transcriptionCb = on_transcription;
        s_errorCb = on_error;
        s_userData = user_data;

        NSLocale *locale = nil;
        if (locale_identifier && strlen(locale_identifier) > 0) {
            locale = [NSLocale localeWithLocaleIdentifier:[NSString stringWithUTF8String:locale_identifier]];
        } else {
            locale = [NSLocale currentLocale];
        }

        s_speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
        if (!s_speechRecognizer) {
            [s_lock unlock];
            return 4; // Recognizer not available for locale
        }

        if (!s_speechRecognizer.isAvailable) {
            s_speechRecognizer = nil;
            [s_lock unlock];
            return 4; // Recognizer unavailable
        }

        s_audioEngine = [[AVAudioEngine alloc] init];
        AVAudioInputNode *inputNode = [s_audioEngine inputNode];
        if (!inputNode) {
            s_audioEngine = nil;
            s_speechRecognizer = nil;
            [s_lock unlock];
            return 5; // No audio input node
        }

        s_recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
        if (!s_recognitionRequest) {
            s_audioEngine = nil;
            s_speechRecognizer = nil;
            [s_lock unlock];
            return 5;
        }

        s_recognitionRequest.shouldReportPartialResults = YES;

        if (@available(macOS 10.15, *)) {
            if (s_speechRecognizer.supportsOnDeviceRecognition) {
                s_recognitionRequest.requiresOnDeviceRecognition = on_device_only ? YES : NO;
            } else if (on_device_only) {
                // Requested on-device only, but not supported
                s_recognitionRequest = nil;
                s_audioEngine = nil;
                s_speechRecognizer = nil;
                [s_lock unlock];
                return 7; // On-device recognition not supported for locale
            }
        }

        AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];
        if (!recordingFormat || recordingFormat.sampleRate <= 0.0 || recordingFormat.channelCount == 0) {
            s_recognitionRequest = nil;
            s_audioEngine = nil;
            s_speechRecognizer = nil;
            [s_lock unlock];
            return 5; // Invalid recording format
        }

        // Install audio tap with small buffer for minimal latency (< 150ms)
        [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
            (void)when;
            if (s_recognitionRequest) {
                [s_recognitionRequest appendAudioPCMBuffer:buffer];
            }
        }];

        [s_audioEngine prepare];
        NSError *startError = nil;
        if (![s_audioEngine startAndReturnError:&startError]) {
            [inputNode removeTapOnBus:0];
            s_recognitionRequest = nil;
            s_audioEngine = nil;
            s_speechRecognizer = nil;
            [s_lock unlock];
            if (s_errorCb) {
                s_errorCb((int32_t)startError.code, startError.localizedDescription.UTF8String, s_userData);
            }
            return 5; // Failed to start audio engine
        }

        s_recognitionTask = [s_speechRecognizer recognitionTaskWithRequest:s_recognitionRequest resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {
            if (result) {
                NSString *text = result.bestTranscription.formattedString;
                BOOL isFinal = result.isFinal;
                if (s_transcriptionCb) {
                    s_transcriptionCb(text ? text.UTF8String : "", (bool)isFinal, s_userData);
                }
            }
            if (error) {
                // If cancelled normally, don't treat as error
                if (error.code != 216 && error.code != 203) { // 216 is cancelled, 203 is timeout/retry
                    if (s_errorCb) {
                        s_errorCb((int32_t)error.code, error.localizedDescription.UTF8String, s_userData);
                    }
                }
            }
        }];

        s_isRecognizing = YES;
    }

    [s_lock unlock];
    return 0; // Success
}

int32_t helmvoice_stop_recognition(void) {
    [s_lock lock];
    if (!s_isRecognizing) {
        [s_lock unlock];
        return 6; // Not running
    }

    @autoreleasepool {
        if (s_audioEngine) {
            if (s_audioEngine.isRunning) {
                [s_audioEngine stop];
            }
            AVAudioInputNode *inputNode = [s_audioEngine inputNode];
            if (inputNode) {
                [inputNode removeTapOnBus:0];
            }
        }

        if (s_recognitionRequest) {
            [s_recognitionRequest endAudio];
            s_recognitionRequest = nil;
        }

        if (s_recognitionTask) {
            [s_recognitionTask finish];
            s_recognitionTask = nil;
        }

        s_audioEngine = nil;
        s_speechRecognizer = nil;
        s_isRecognizing = NO;
        s_transcriptionCb = NULL;
        s_errorCb = NULL;
        s_userData = NULL;
    }

    [s_lock unlock];
    return 0; // Success
}

bool helmvoice_is_recognizing(void) {
    [s_lock lock];
    bool recognizing = (bool)s_isRecognizing;
    [s_lock unlock];
    return recognizing;
}
