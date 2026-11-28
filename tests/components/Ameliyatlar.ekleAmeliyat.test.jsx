import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as surgeriesAdapter from '../../src/services/surgeriesAdapter.js';
import * as patientsAdapter from '../../src/services/patientsAdapter.js';
import Ameliyatlar from '../../src/pages/Ameliyatlar.jsx';
import { useDataStore, useAuthStore, useUIStore } from '../../src/store';

// Minor Finding B (final review): bare POST .../surgeries yanıtı (RETURNING
// *, join yok) hasta/salon adını içermez — adapter bu alanları boş string
// döner, yeni eklenen satır reload'a kadar hasta/salon sütunları boş
// görünürdü. ekleAmeliyat() artık formda zaten bilinen hasta/salon adlarıyla
// bu boşluğu dolduruyor.

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.setItem('operio_access', 'test-token');
  useAuthStore.setState({ curRole: 0 });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
  useDataStore.setState({
    surgeries: [], hastalar: [], bildirimler: [],
    rooms: [{ id: 'r1', ad: 'Salon 1' }],
  });
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
});

describe('Ameliyatlar.jsx — ekleAmeliyat() (Minor Finding B)', () => {
  it('yeni eklenen ameliyat satırı hasta/salon adını reload beklemeden gösterir', async () => {
    vi.spyOn(patientsAdapter, 'listPatients').mockResolvedValue([
      { id: 'p1', ad: 'Ayşe', soyad: 'Demir' },
    ]);
    // Bare POST yanıtını simüle ediyor: mapSurgery join alanları olmadan
    // hasta/salon'u boş string döner.
    vi.spyOn(surgeriesAdapter, 'createSurgery').mockResolvedValue({
      id: 'new1', op: 'Apendektomi', hasta: '', salon: '', dr: '', durum: 'Bekliyor', st: 'dot-wait', saat: '08:00', bitis: '10:00',
    });

    render(<MemoryRouter><Ameliyatlar /></MemoryRouter>);

    fireEvent.click(screen.getByText('+ Ekle'));
    fireEvent.change(screen.getByPlaceholderText('Laparoskopik Kolesistektomi...'), { target: { value: 'Apendektomi' } });
    fireEvent.change(screen.getByPlaceholderText('Ad Soyad'), { target: { value: 'Ayşe Demir' } });
    fireEvent.change(screen.getByText('Salon seçin (opsiyonel)').closest('select'), { target: { value: 'r1' } });
    fireEvent.click(screen.getByText('Ameliyat Ekle'));

    await waitFor(() => expect(surgeriesAdapter.createSurgery).toHaveBeenCalled());
    await waitFor(() => expect(useDataStore.getState().surgeries.length).toBe(1));

    const eklenen = useDataStore.getState().surgeries[0];
    expect(eklenen.hasta).toBe('Ayşe Demir');
    expect(eklenen.salon).toBe('Salon 1');
  });
});
