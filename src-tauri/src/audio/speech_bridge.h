#ifndef HELMVOICE_SPEECH_BRIDGE_H
#define HELMVOICE_SPEECH_BRIDGE_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Permission statuses:
// 0: NotDetermined, 1: Denied, 2: Restricted, 3: Authorized
typedef enum {
    HELMVOICE_PERM_NOT_DETERMINED = 0,
    HELMVOICE_PERM_DENIED = 1,
    HELMVOICE_PERM_RESTRICTED = 2,
    HELMVOICE_PERM_AUTHORIZED = 3
} HelmVoicePermissionStatus;

typedef void (*HelmVoicePermissionCallback)(HelmVoicePermissionStatus status, void *user_data);
typedef void (*HelmVoiceTranscriptionCallback)(const char *text, bool is_final, void *user_data);
typedef void (*HelmVoiceErrorCallback)(int32_t error_code, const char *error_message, void *user_data);

// Check permission statuses
HelmVoicePermissionStatus helmvoice_check_speech_permission(void);
HelmVoicePermissionStatus helmvoice_check_microphone_permission(void);

// Request permissions asynchronously
void helmvoice_request_speech_permission(HelmVoicePermissionCallback callback, void *user_data);
void helmvoice_request_microphone_permission(HelmVoicePermissionCallback callback, void *user_data);

// Check if on-device recognition is supported for locale
bool helmvoice_is_on_device_supported(const char *locale_identifier);

// Start / Stop recognition
// Returns 0 on success, or non-zero error code
int32_t helmvoice_start_recognition(
    const char *locale_identifier,
    bool on_device_only,
    HelmVoiceTranscriptionCallback on_transcription,
    HelmVoiceErrorCallback on_error,
    void *user_data
);

int32_t helmvoice_stop_recognition(void);

bool helmvoice_is_recognizing(void);

#ifdef __cplusplus
}
#endif

#endif // HELMVOICE_SPEECH_BRIDGE_H
