/**
 * SpeakerVerifier — soyut taban sınıf.
 * Ses örneğinden ("audioBuffer") konuşmacıyı aday havuzu ("candidateUserIds")
 * içinde tanımlayan sürücüler bu tek metodu uygulamalıdır. Taban sınıf
 * gerçekleştirmez; çağrılırsa 'not implemented' hatası fırlatır (bkz.
 * DeviceDriver ile aynı desen).
 */
class SpeakerVerifier {
  /**
   * @param {Buffer|any|null} audioBuffer — ses örneği (sürücüye göre değişir). null
   *   olabilir (kiosk henüz ses parçası kaydetmemiş / mikrofon izni yok): gerçek bir
   *   sürücü bu durumda FIRLATMAMALI, null ("tanınamadı") döndürmelidir. Mock sürücü
   *   bu parametreyi hiç kullanmaz.
   * @param {string[]} candidateUserIds — bu odadaki aktif ameliyatın ekip üyelerinin userId'leri.
   * @param {{ mode: string, cycleIndex: number }} config — kurumun mock konuşmacı-doğrulama
   *   konfigürasyonu (kiosk.service.js'in getMockConfig'inden). Gerçek (mock olmayan) bir
   *   sürücü bu parametreyi görmezden geçebilir.
   * @returns {Promise<{ userId: string, confidence: number } | null>}
   */
  async identify(audioBuffer, candidateUserIds, config) {
    throw new Error('not implemented');
  }
}

module.exports = { SpeakerVerifier };
