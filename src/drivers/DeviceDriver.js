/**
 * DeviceDriver — soyut taban sınıf.
 * Her cihaz sürücüsü bu 7 metodu uygulamalıdır. Taban sınıf hiçbirini
 * gerçekleştirmez; çağrılırsa 'not implemented' hatası fırlatır.
 */
class DeviceDriver {
  constructor(device) {
    this.device = device;
  }

  async turnOn() {
    throw new Error('not implemented');
  }

  async turnOff() {
    throw new Error('not implemented');
  }

  async setPower(level) {
    throw new Error('not implemented');
  }

  async armMove(preset) {
    throw new Error('not implemented');
  }

  async confirmPhysical() {
    throw new Error('not implemented');
  }

  async getStatus() {
    throw new Error('not implemented');
  }

  async invokeAction(name, args) {
    throw new Error('not implemented');
  }
}

module.exports = { DeviceDriver };
