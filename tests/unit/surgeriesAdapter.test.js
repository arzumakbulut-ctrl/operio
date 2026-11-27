import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSurgeries, createSurgery, updateSurgeryStatus, assignTeamMember, removeTeamMember } from '../../src/services/surgeriesAdapter.js';

const BASE = 'http://localhost:4000/api';

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  global.fetch = vi.fn();
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listSurgeries', () => {
  it('backend zarfını açar ve alanları UI şekline çevirir (IN_PROGRESS -> Devam Ediyor)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 's1', title: 'Apendektomi', branch: 'Genel Cerrahi', surgeon_name: 'Dr. Ahmet Yılmaz',
          scheduled_start: '2026-11-28T08:30:00.000Z', scheduled_end: null, duration_min: 90,
          status: 'IN_PROGRESS', notes: null, room_name: 'Salon 1', room_number: 1,
          patient_name: 'Ayşe Demir', tc_no: '12345678901', blood_type: 'A+',
        }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      }),
    });

    const result = await listSurgeries();

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 's1', op: 'Apendektomi', hasta: 'Ayşe Demir', dr: 'Dr. Ahmet Yılmaz',
      salon: 'Salon 1', durum: 'Devam Ediyor', st: 'dot-active', brans: 'Genel Cerrahi',
    });
  });

  it('CANCELLED ve POSTPONED durumları "Bekliyor" filtresine düşer (Review Focus)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [
        { id:'s2', title:'X', status:'CANCELLED', scheduled_start:'2026-11-28T08:00:00.000Z' },
        { id:'s3', title:'Y', status:'POSTPONED', scheduled_start:'2026-11-28T08:00:00.000Z' },
      ], meta:{} }),
    });
    const result = await listSurgeries();
    expect(result[0].durum).toBe('Bekliyor');
    expect(result[1].durum).toBe('Bekliyor');
  });

  it('backend {success:false} dönerse boş dizi döner, FIRLATMAZ', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ success:false, error:{code:'UNAUTHORIZED'} }) });
    const result = await listSurgeries();
    expect(result).toEqual([]);
  });
});

describe('createSurgery', () => {
  it('doğru path+body ile POST atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'new1', title:'Yeni Ameliyat', status:'WAITING', scheduled_start:'2026-11-28T09:00:00.000Z' } }) });
    const result = await createSurgery({ title:'Yeni Ameliyat', scheduledStart:'2026-11-28T09:00:00.000Z' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title:'Yeni Ameliyat', scheduledStart:'2026-11-28T09:00:00.000Z' }),
    }));
    expect(result.op).toBe('Yeni Ameliyat');
  });
});

describe('updateSurgeryStatus', () => {
  it('PATCH /surgeries/:id {status} atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'s1', status:'COMPLETED', title:'X', scheduled_start:'2026-11-28T08:00:00.000Z' } }) });
    await updateSurgeryStatus('s1', 'COMPLETED');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1`, expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }),
    }));
  });
});

describe('assignTeamMember / removeTeamMember', () => {
  it('assignTeamMember POST /surgeries/:id/team {userId, teamRole} atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{} }) });
    await assignTeamMember('s1', 'u1', 'cerrah');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1/team`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ userId: 'u1', teamRole: 'cerrah' }),
    }));
  });

  it('removeTeamMember DELETE /surgeries/:id/team/:userId atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{} }) });
    await removeTeamMember('s1', 'u1');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1/team/u1`, expect.objectContaining({ method: 'DELETE' }));
  });
});
