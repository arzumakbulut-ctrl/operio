import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Windows'ta 'localhost' DNS'i IPv6'yi (::1) once dondurdugu icin
    // Vite varsayilaniyla sadece ::1'e bagleniyordu; 127.0.0.1 "baglanamiyor" veriyordu.
    host: true,
  },
})
