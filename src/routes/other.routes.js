const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const {
  patientCreateSchema, roomCreateSchema, roomStatusSchema,
  sterileSetCreateSchema, sterileSetUpdateSchema, setTrackingSchema, paginationSchema,
} = require('../validators/schemas');
const patientService    = require('../services/patient.service');
const roomService       = require('../services/room.service');
const sterileSetService = require('../services/sterileSet.service');
const db                = require('../utils/db');
const { ok, created, notFound, serverError } = require('../utils/response');

// ── HASTALAR ─────────────────────────────────────────────────
const patientRouter = require('express').Router();
patientRouter.use(authenticate);

patientRouter.get('/', authorize(0,1,6,7,10), validateQuery(paginationSchema), async (req,res) => {
  try {
    const r = await patientService.listPatients(req.query);
    return ok(res, r.patients, { total:r.total, page:r.page, totalPages:r.totalPages });
  } catch(err) { return serverError(res,err); }
});

patientRouter.get('/:id', authorize(0,1,6,7,10), async (req,res) => {
  try {
    const p = await patientService.getPatient(req.params.id);
    if(!p) return notFound(res,'Hasta');
    return ok(res,p);
  } catch(err) { return serverError(res,err); }
});

patientRouter.post('/', authorize(0,1,7), validate(patientCreateSchema), async (req,res) => {
  try {
    const p = await patientService.createPatient({ data:req.body, userId:req.user.sub, req });
    return created(res,p);
  } catch(err) { return serverError(res,err); }
});

patientRouter.patch('/:id', authorize(0,1,7), validate(patientCreateSchema.partial()), async (req,res) => {
  try {
    const p = await patientService.updatePatient({ id:req.params.id, data:req.body, userId:req.user.sub, req });
    if(!p) return notFound(res,'Hasta');
    return ok(res,p);
  } catch(err) { return serverError(res,err); }
});

// ── SALONLAR ─────────────────────────────────────────────────
const roomRouter = require('express').Router();
roomRouter.use(authenticate);

roomRouter.get('/', async (req,res) => {
  try {
    const rooms = await roomService.listRooms(req.user.institutionId);
    return ok(res,rooms);
  } catch(err) { return serverError(res,err); }
});

roomRouter.get('/:id', async (req,res) => {
  try {
    const room = await roomService.getRoom({ id:req.params.id, institutionId:req.user.institutionId });
    if(!room) return notFound(res,'Salon');
    return ok(res,room);
  } catch(err) { return serverError(res,err); }
});

roomRouter.post('/', authorize(0,1), validate(roomCreateSchema), async (req,res) => {
  try {
    const room = await roomService.createRoom({ data:req.body, institutionId:req.user.institutionId, userId:req.user.sub, req });
    return created(res,room);
  } catch(err) { return serverError(res,err); }
});

roomRouter.patch('/:id/status', authorize(0,1,8), validate(roomStatusSchema), async (req,res) => {
  try {
    const room = await roomService.updateRoomStatus({ id:req.params.id, status:req.body.status, institutionId:req.user.institutionId, userId:req.user.sub, req });
    if(!room) return notFound(res,'Salon');
    return ok(res,room);
  } catch(err) { return serverError(res,err); }
});

roomRouter.delete('/:id', authorize(0), async (req,res) => {
  try {
    const deleted = await roomService.deleteRoom({ id:req.params.id, institutionId:req.user.institutionId, userId:req.user.sub, req });
    if(!deleted) return notFound(res,'Salon');
    return ok(res, { message:'Salon silindi' });
  } catch(err) { return serverError(res,err); }
});

// ── STERİL SETLER ─────────────────────────────────────────────
const setRouter = require('express').Router();
setRouter.use(authenticate);

setRouter.get('/', validateQuery(paginationSchema.extend({ status:z.string().optional() })), async (req,res) => {
  try {
    const r = await sterileSetService.listSets(req.query);
    return ok(res, r.sets, { total:r.total, page:r.page, totalPages:r.totalPages });
  } catch(err) { return serverError(res,err); }
});

setRouter.get('/:id', async (req,res) => {
  try {
    const s = await sterileSetService.getSet(req.params.id);
    if(!s) return notFound(res,'Steril Set');
    return ok(res,s);
  } catch(err) { return serverError(res,err); }
});

setRouter.post('/', authorize(0,1,8), validate(sterileSetCreateSchema), async (req,res) => {
  try {
    const s = await sterileSetService.createSet({ data:req.body, userId:req.user.sub, req });
    return created(res,s);
  } catch(err) { return serverError(res,err); }
});

setRouter.patch('/:id', authorize(0,1,8,9), validate(sterileSetUpdateSchema), async (req,res) => {
  try {
    const s = await sterileSetService.updateSet({ id:req.params.id, data:req.body, userId:req.user.sub, req });
    if(!s) return notFound(res,'Steril Set');
    return ok(res,s);
  } catch(err) { return serverError(res,err); }
});

setRouter.post('/:id/tracking', authorize(0,1,8,9), validate(setTrackingSchema), async (req,res) => {
  try {
    const log = await sterileSetService.addTrackingLog({ setId:req.params.id, ...req.body, userId:req.user.sub, req });
    return created(res,log);
  } catch(err) { return serverError(res,err); }
});

// ── DENETİM GÜNLÜĞÜ ──────────────────────────────────────────
const auditRouter = require('express').Router();
auditRouter.use(authenticate, authorize(0));

auditRouter.get('/', validateQuery(paginationSchema.extend({
  resource: z.string().optional(),
  action:   z.string().optional(),
  userId:   z.string().optional(),
})), async (req,res) => {
  try {
    const { page=1, limit=50, resource, action, userId } = req.query;
    const conditions = [];
    const params = [];
    let pi = 1;
    if (resource) { conditions.push(`a.resource = $${pi++}`); params.push(resource); }
    if (action)   { conditions.push(`a.action = $${pi++}`);   params.push(action); }
    if (userId)   { conditions.push(`a.user_id = $${pi++}`);  params.push(userId); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page-1)*limit;

    const [{ rows: logs }, { rows: countRows }] = await Promise.all([
      db.query(
        `SELECT a.*, u.full_name, u.email
         FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
         ${where} ORDER BY a.created_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM audit_logs a ${where}`, params),
    ]);

    const total = parseInt(countRows[0].count);
    return ok(res, logs, { total, page, limit, totalPages: Math.ceil(total/limit) });
  } catch(err) { return serverError(res,err); }
});

module.exports = { patientRouter, roomRouter, setRouter, auditRouter };
