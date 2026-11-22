describe('speakerIdClient.getEmbedding', () => {
  it('voice_detected:true dönerse embedding dizisini döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: true, embedding: [0.1, 0.2, 0.3] }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    const result = await getEmbedding('base64data');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('voice_detected:false dönerse null döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: false }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });

  it('servis 400/500 dönerse veya ağ hatası olursa fırlatmaz, null döner', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });
});
