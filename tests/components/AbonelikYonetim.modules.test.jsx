import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AbonelikYonetim from '../../src/pages/AbonelikYonetim.jsx';

// AbonelikYonetim.jsx (mevcut kod) useNavigate() kullanıyor — bileşen bir
// <Router> olmadan da render edilebilsin diye mock'lanıyor (bu modüller
// bölümüyle ilgisi yok, bileşenin önceden var olan bir bağımlılığı).
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../src/services/api.js', () => ({
  moduleAPI: {
    list: vi.fn().mockResolvedValue([{ slug: 'voice_control', name: 'Sesli Kontrol', price_try: 500000 }]),
    mine: vi.fn().mockResolvedValue([]),
    purchase: vi.fn().mockResolvedValue({ module_slug: 'voice_control', status: 'active' }),
  },
  // ...mevcut diğer mock'lar AbonelikYonetim.jsx'in zaten kullandığı diğer API'ler için gerekirse eklenir
}));

describe('AbonelikYonetim — Modüller bölümü', () => {
  it('satın alınmamış modülü "Satın Al" butonuyla göstermeli', async () => {
    render(<AbonelikYonetim />);
    expect(await screen.findByText('Sesli Kontrol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /satın al/i })).toBeInTheDocument();
  });

  it('Satın Al tıklanınca moduleAPI.purchase çağrılmalı', async () => {
    const { moduleAPI } = await import('../../src/services/api.js');
    render(<AbonelikYonetim />);
    fireEvent.click(await screen.findByRole('button', { name: /satın al/i }));
    await waitFor(() => expect(moduleAPI.purchase).toHaveBeenCalledWith('voice_control'));
  });
});
