import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Abonelik from '../../src/pages/Abonelik.jsx';

vi.mock('../../src/services/api.js', () => ({
  moduleAPI: {
    list: vi.fn().mockResolvedValue([{ slug: 'voice_control', name: 'Sesli Kontrol', price_try: 500000 }]),
    mine: vi.fn().mockResolvedValue([]),
    purchase: vi.fn().mockResolvedValue({ module_slug: 'voice_control', status: 'active' }),
  },
}));

describe('Abonelik — Eklenti Modülleri bölümü', () => {
  it('satın alınmamış modülü "Satın Al" butonuyla göstermeli', async () => {
    render(<Abonelik />);
    // Eklenti modülleri bölümü "Modüller" sekmesinde (Abonelik.jsx kendi
    // hardcoded plan-içi OPERIO_MODULLER listesinin altında ayrı bir bölüm).
    fireEvent.click(screen.getByText('🔧 Modüller'));
    expect(await screen.findByText('Sesli Kontrol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /satın al/i })).toBeInTheDocument();
  });

  it('Satın Al tıklanınca moduleAPI.purchase çağrılmalı', async () => {
    const { moduleAPI } = await import('../../src/services/api.js');
    render(<Abonelik />);
    fireEvent.click(screen.getByText('🔧 Modüller'));
    fireEvent.click(await screen.findByRole('button', { name: /satın al/i }));
    await waitFor(() => expect(moduleAPI.purchase).toHaveBeenCalledWith('voice_control'));
  });
});
