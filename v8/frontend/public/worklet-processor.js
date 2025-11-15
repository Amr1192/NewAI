/**
 * PCM16 Audio Worklet Processor
 * Converts audio to PCM16 format for OpenAI Realtime API
 */

class PCM16Sender extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // If no input, return
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0]; // Mono channel
    
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];
      
      // When buffer is full, convert and send
      if (this.bufferIndex >= this.bufferSize) {
        this.sendPCM16();
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }

  sendPCM16() {
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    const pcm16 = new Int16Array(this.bufferSize);
    
    for (let i = 0; i < this.bufferSize; i++) {
      // Clamp to [-1, 1] and scale to Int16 range
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    
    // Send to main thread
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
  }
}

registerProcessor('pcm16-sender', PCM16Sender);