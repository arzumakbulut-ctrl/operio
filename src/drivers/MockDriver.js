const { DeviceDriver } = require('./DeviceDriver');

/**
 * MockDriver — gerçek donanım olmadan çalışan deterministik simülatör.
 * Gecikme yoktur; testlerin hızlı ve kararlı kalması için.
 *
 * Durumlar: OFF | ON | ARMED
 *   armMove(preset)  → ARMED (hareket hazırlandı, henüz fiziksel onay yok)
 *   confirmPhysical() → ARMED → ON
 */
class MockDriver extends DeviceDriver {
  constructor(device) {
    super(device);
    this._power_state = device && device.power_state ? device.power_state : 'OFF';
    this._power_level = device && typeof device.power_level === 'number' ? device.power_level : 0;
    this._armed_preset = null;
  }

  _status() {
    return { power_state: this._power_state, power_level: this._power_level };
  }

  async turnOn() {
    this._power_state = 'ON';
    return this._status();
  }

  async turnOff() {
    this._power_state = 'OFF';
    this._power_level = 0;
    this._armed_preset = null;
    return this._status();
  }

  async setPower(level) {
    this._power_state = 'ON';
    this._power_level = level;
    return this._status();
  }

  async armMove(preset) {
    this._power_state = 'ARMED';
    this._armed_preset = preset;
    return this._status();
  }

  async confirmPhysical() {
    if (this._power_state !== 'ARMED') {
      throw new Error('no armed move to confirm');
    }
    this._power_state = 'ON';
    this._armed_preset = null;
    return this._status();
  }

  async getStatus() {
    return this._status();
  }

  async invokeAction(name, args) {
    return this._status();
  }
}

module.exports = { MockDriver };
