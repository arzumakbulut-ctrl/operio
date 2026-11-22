const { MockDriver } = require('./MockDriver');

/** driver_key → sürücü sınıfı. Yeni sürücüler buraya eklenir. */
const DRIVERS = {
  mock: MockDriver,
};

/**
 * device.driver_key'e göre sürücü örneği döndürür.
 * Bilinmeyen veya eksik anahtar için güvenli varsayılan olarak MockDriver kullanılır.
 * Not: hasOwnProperty kontrolü, 'constructor' gibi prototip anahtarlarının
 * yanlış sınıfa çözülmesini engeller.
 */
function getDriver(device) {
  const key = device && device.driver_key;
  const Klass = key && Object.prototype.hasOwnProperty.call(DRIVERS, key)
    ? DRIVERS[key]
    : MockDriver;
  return new Klass(device);
}

/**
 * isRealDriverKey(driverKey) — true sadece driverKey, DRIVERS'ta kayıtlı ve 'mock'
 * olmayan gerçek bir sürücüye karşılık geliyorsa. 'mock' DRIVERS'ta bir anahtar olsa
 * da (MockDriver'a eşlenir) kasıtlı olarak "gerçek" sayılmaz — bu fonksiyon,
 * device.service.js'in mode='REAL' geçişini kapıda tutması için var: REAL mod asla
 * mock sürücüyle veya kayıtsız bir anahtarla etkin olamaz. getDriver'ın kullandığı
 * aynı hasOwnProperty mekanizmasını kullanır (prototip anahtarlarına karşı güvenli).
 */
function isRealDriverKey(driverKey) {
  return driverKey !== 'mock'
    && typeof driverKey === 'string'
    && Object.prototype.hasOwnProperty.call(DRIVERS, driverKey);
}

module.exports = { getDriver, DRIVERS, isRealDriverKey };
