/**
 * AudioRecorderWorklet - Collects Float32 audio samples and buffers them
 * into 2048-sample raw 16-bit signed PCM ArrayBuffers for the Gemini Live API.
 * Includes a gentle noise gate to suppress ambient room chatter during pauses.
 */
class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        for (let i = 0; i < channelData.length; i++) {
          this.buffer[this.bufferIndex++] = channelData[i];
          if (this.bufferIndex >= this.bufferSize) {
            // Calculate RMS energy of the audio chunk
            let sumSquare = 0;
            for (let j = 0; j < this.bufferSize; j++) {
              sumSquare += this.buffer[j] * this.buffer[j];
            }
            const rms = Math.sqrt(sumSquare / this.bufferSize);

            const pcm16 = new Int16Array(this.bufferSize);
            // Noise gate: if below ambient threshold (~ -50dB), zero out background murmur
            const isSubThreshold = rms < 0.003;

            for (let j = 0; j < this.bufferSize; j++) {
              if (isSubThreshold) {
                pcm16[j] = 0;
              } else {
                const s = Math.max(-1, Math.min(1, this.buffer[j]));
                pcm16[j] = s < 0 ? s * 32768 : s * 32767;
              }
            }

            this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }
        }
      }
    }
    return true;
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
