/**
 * Servis Kayıt Defteri — Global Singleton
 * ESM/CJS çift yükleme sorununu önlemek için global store kullanır
 */

// global.__operio_registry yoksa oluştur
if (!global.__operio_registry) {
  global.__operio_registry = {};
}

const _services = global.__operio_registry;

function register(name, service) {
  _services[name] = service;
}

function get(name, defaultFactory) {
  if (!_services[name]) {
    _services[name] = defaultFactory();
  }
  return _services[name];
}

function reset() {
  Object.keys(_services).forEach(k => delete _services[k]);
}

module.exports = { register, get, reset };
