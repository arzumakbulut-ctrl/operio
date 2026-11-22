const { SpotifyPlaybackDriver } = require('./SpotifyPlaybackDriver');
const { audit } = require('../utils/audit');

/**
 * MockSpotifyPlaybackDriver — gerçek donanım/Spotify "play" çağrısı olmadan
 * SPOTIFY_PLAY akışını test etmeye/demo etmeye yarayan deterministik simülatör.
 *
 * play() KASITLI olarak hiçbir ağ çağrısı yapmaz (gerçek Spotify play/
 * transfer-playback endpoint'i bu fazda hiç çağrılmaz — bkz. plan/
 * SpotifyPlaybackDriver.js dosya başı notu). Tek yan etkisi bir audit() yazısıdır
 * (kioskSpeakerAuth henüz konuşmacıyı doğruladığı için userId zaten biliniyor
 * olsa da, DEVICE_COMMAND'ın audit desenine [bkz. device.service.js] paralel
 * olarak burada da kayıt resource='controllable_devices' ile tutulur — bu
 * kayıt, hangi cihazın/kaynağın etkilendiğini değil "sesli komutla bir eylem
 * tetiklendi" olayını izler; userId: null KASITLIDIR — bkz. recordTimeoutRead
 * ile aynı konvansiyon, konuşmacı kimliği zaten newData.userName'de insan-
 * okunur biçimde taşınıyor).
 */
class MockSpotifyPlaybackDriver extends SpotifyPlaybackDriver {
  /**
   * @param {{ userName: string, trackName: string, roomId?: string, req?: object }} params
   * @returns {Promise<{ message: string }>}
   */
  async play({ userName, trackName, roomId, req }) {
    await audit({
      userId:     null,
      action:     'voice:spotify_play',
      resource:   'controllable_devices',
      resourceId: null,
      newData:    { userName, trackName, roomId },
      req,
    });

    return { message: `${userName}'in Spotify hesabından ${trackName} çalınıyor (mock).` };
  }
}

module.exports = { MockSpotifyPlaybackDriver };
