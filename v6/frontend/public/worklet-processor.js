class PCM16Sender extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const ch = input[0];
    const buf = new ArrayBuffer(ch.length * 2);
    const view = new DataView(buf);

    for (let i = 0; i < ch.length; i++) {
      let s = Math.max(-1, Math.min(1, ch[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    this.port.postMessage(buf, [buf]);
    return true;
  }
}

registerProcessor('pcm16-sender', PCM16Sender);
