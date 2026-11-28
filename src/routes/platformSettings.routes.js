const router = require('express').Router();
const { authenticatePlatformAdmin, authorizePlatformAdmin } = require('../middleware/platformAdminAuth');
const { validate } = require('../middleware/validate');
const { platformSettingsUpdateSchema } = require('../validators/schemas');
const { ok, notFound, badRequest, conflict, forbidden, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (bkz. institutionGroups.routes.js'in AYNI deseni)
const registry = require('../services/_registry');
const getService = () => registry.get('platformSettings', () => require('../services/platformSettings.service'));
const setService = (svc) => registry.register('platformSettings', svc);

function mapError(res, err) {
  switch (err.statusCode) {
    case 400: return badRequest(res, err.message);
    case 403: return forbidden(res, err.message);
    case 409: return conflict(res, err.message);
    default:  return serverError(res, err);
  }
}

// Platform ayarları (bakım modu, deneme süresi, faturalama vb.) yalnızca 'super'
// grubunun sorumluluğunda — finans/destek/icerik erişemez.
router.use(authenticatePlatformAdmin);

router.get('/', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    const settings = await getService().getSettings();
    if (!settings) return notFound(res, 'Platform ayarları');
    return ok(res, settings);
  } catch (err) { return mapError(res, err); }
});

router.patch('/', authorizePlatformAdmin('super'), validate(platformSettingsUpdateSchema), async (req, res) => {
  try {
    const settings = await getService().updateSettings({
      data: req.body, actorId: req.platformAdmin.sub, req,
    });
    if (!settings) return notFound(res, 'Platform ayarları');
    return ok(res, settings);
  } catch (err) { return mapError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
