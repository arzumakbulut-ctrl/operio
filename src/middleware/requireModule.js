const { forbidden } = require('../utils/response');
const registry = require('../services/_registry');

const getModuleService = () => registry.get('module', () => require('../services/module.service'));

/**
 * requireModule(slug) — authenticate'den sonra kullanılır.
 * Kurum, belirtilen modülü aktif olarak satın almamışsa 403 döner.
 */
function requireModule(slug) {
  return async (req, res, next) => {
    try {
      const active = await getModuleService().hasActiveModule({
        institutionId: req.user.institutionId,
        slug,
      });
      if (!active) {
        return forbidden(res, 'Bu modül satın alınmamış');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireModule };
