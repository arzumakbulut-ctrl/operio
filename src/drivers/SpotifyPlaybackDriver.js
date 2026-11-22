/**
 * SpotifyPlaybackDriver — soyut taban sınıf.
 * Çözümlenmiş bir Spotify track/playlist'i (ad + URI — bkz. spotify.service.js'in
 * searchTrackOrPlaylist'i) gerçekten "çalma" eylemini uygulayan sürücüler bu tek
 * metodu gerçekleştirmelidir. Taban sınıf hiçbir şey yapmaz; çağrılırsa 'not
 * implemented' hatası fırlatır (bkz. DeviceDriver/SpeakerVerifier ile aynı desen).
 *
 * TASARIM NOTU: gerçek Spotify Web API'nin play/transfer-playback endpoint'i bu
 * fazda HİÇ çağrılmaz (bkz. plan) — sadece arama/resolve gerçek API'dir
 * (spotify.service.searchTrackOrPlaylist). Bu yüzden somut sürücüler ağ çağrısı
 * yapmak ZORUNDA değildir (bkz. MockSpotifyPlaybackDriver — hiç yapmaz).
 */
class SpotifyPlaybackDriver {
  /**
   * @param {{ userName: string, trackName: string, roomId?: string }} params
   *   - userName: konuşmacının tam adı (req.speaker.fullName).
   *   - trackName: searchTrackOrPlaylist'in döndürdüğü track/playlist adı.
   *   - roomId: audit kaydına eklenecek oda id'si (opsiyonel, çağırana bağlı).
   *   Not: somut sürücüler kendi audit() çağrıları için aynı obje üzerinden ek
   *   alanlar (örn. req) da kabul edebilir — taban sınıf bunları zorunlu kılmaz.
   * @returns {Promise<{ message: string }>}
   */
  async play({ userName, trackName, roomId }) {
    throw new Error('not implemented');
  }
}

module.exports = { SpotifyPlaybackDriver };
