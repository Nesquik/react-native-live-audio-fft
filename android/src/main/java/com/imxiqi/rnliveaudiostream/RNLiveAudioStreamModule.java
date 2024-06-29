package com.imxiqi.rnliveaudiostream;

import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder.AudioSource;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.lang.Math;

public class RNLiveAudioStreamModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;
    private Context context;
    private RecordThread recordThread;

    public RNLiveAudioStreamModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "RNLiveAudioStream";
    }

    @ReactMethod
    public void init(ReadableMap options) {
        boolean speakerPhoneOn = false;
        if (options.hasKey("speakerPhoneOn")) {
            speakerPhoneOn = true;
        }

        int sampleRateInHz = 44100;
        if (options.hasKey("sampleRate")) {
            sampleRateInHz = options.getInt("sampleRate");
        }

        int channelConfig = AudioFormat.CHANNEL_IN_MONO;
        if (options.hasKey("channels")) {
            if (options.getInt("channels") == 2) {
                channelConfig = AudioFormat.CHANNEL_IN_STEREO;
            }
        }

        int audioFormat = AudioFormat.ENCODING_PCM_16BIT;
        if (options.hasKey("bitsPerSample")) {
            if (options.getInt("bitsPerSample") == 8) {
                audioFormat = AudioFormat.ENCODING_PCM_8BIT;
            }
        }

        int audioSource = AudioSource.VOICE_RECOGNITION;
        if (options.hasKey("audioSource")) {
            audioSource = options.getInt("audioSource");
        }

        int bufferSize = AudioRecord.getMinBufferSize(sampleRateInHz, channelConfig, audioFormat);

        if (options.hasKey("bufferSize")) {
            bufferSize = Math.max(bufferSize, options.getInt("bufferSize"));
        }

        recordThread = new RecordThread(audioSource, speakerPhoneOn, sampleRateInHz, channelConfig, audioFormat, bufferSize, reactContext);
    }

    private class RecordThread extends Thread {

        private DeviceEventManagerModule.RCTDeviceEventEmitter eventEmitter;
        private AudioRecord recorder = null;
        private AudioManager audioManager4;
        private int bufferSize;
        public boolean isRecording = false;

        public RecordThread(int audioSource, boolean speakerPhoneOn, int sampleRateInHz, int channelConfig, int audioFormat, int bufferSize, ReactApplicationContext reactContext) {
            super();
            if (speakerPhoneOn) {
                AudioManager audioManager4 = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
                audioManager4.setMode(AudioManager.MODE_IN_COMMUNICATION); // Optional, to set the mode if needed
                audioManager4.setSpeakerphoneOn(true);
            }  
            eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);

            this.bufferSize = bufferSize;
            int recordingBufferSize = bufferSize * 3;
            recorder = new AudioRecord(audioSource, sampleRateInHz, channelConfig, audioFormat, recordingBufferSize);
        }

        public void run() {
            recorder.startRecording();

            try {
                int bytesRead;
                int count = 0;
                String base64Data;
                byte[] buffer = new byte[bufferSize];

                while (isRecording) {
                    bytesRead = recorder.read(buffer, 0, buffer.length);

                    // skip first 2 buffers to eliminate "click sound"
                    if (bytesRead > 0 && ++count > 2) {
                        base64Data = Base64.encodeToString(buffer, Base64.NO_WRAP);
                        eventEmitter.emit("data", base64Data);
                    }
                }
                recorder.stop();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                recorder.release();
                recorder = null;
            }
        }
    }

    @ReactMethod
    public void start() {
        if (recordThread == null || recordThread.isRecording) {
            return;
        }

        recordThread.isRecording = true;
        recordThread.start();
    }

    @ReactMethod
    public void stop() {
        if (recordThread != null) {
            recordThread.isRecording = false;
            recordThread = null;
        }
    }
}
