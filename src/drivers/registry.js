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

module.exports = { getDriver, DRIVERS };
