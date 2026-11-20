import { useEffect, useRef } from 'react';

// Orijinal initWidgetDragDrop — React uyumlu versiyon
// DOM manipülasyonu yerine React render dışında çalışır
// Her sayfa mount'unda bir kez init edilir, cleanup ile temizlenir

export function useWidgetDragDrop() {
  const dragEl = useRef(null);
  const cleanupFns = useRef([]);

  useEffect(() => {
    // Temizle
    cleanupFns.current.forEach(fn => fn());
    cleanupFns.current = [];

    const init = () => {
      const panels = [...document.querySelectorAll('#mainContent .panel')]
        .filter(p => p.querySelector('.panel-hd') && !p.querySelector('.widget-handle'));

      if (!panels.length) return;

      panels.forEach(panel => {
        const hd = panel.querySelector('.panel-hd');
        if (!hd) return;

        // Handle oluştur
        const handle = document.createElement('div');
        handle.className = 'widget-handle';
        handle.title = 'Sürükleyerek taşıyın';
        Object.assign(handle.style, {
          cursor: 'grab', width: '24px', height: '24px',
          borderRadius: '6px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--slate-light)',
          fontSize: '14px', userSelect: 'none', transition: 'all 0.15s',
          border: '1px solid var(--border)', background: 'var(--card-bg)',
          position: 'absolute', top: '14px', right: '14px', zIndex: '10',
          flexShrink: '0',
        });
        handle.innerHTML = '⠿';

        const onOver = () => {
          handle.style.color = 'var(--teal)';
          handle.style.borderColor = 'rgba(20,184,166,0.4)';
          handle.style.background = 'rgba(20,184,166,0.08)';
        };
        const onOut = () => {
          handle.style.color = 'var(--slate-light)';
          handle.style.borderColor = 'var(--border)';
          handle.style.background = 'var(--card-bg)';
        };
        handle.addEventListener('mouseover', onOver);
        handle.addEventListener('mouseout', onOut);

        if (getComputedStyle(panel).position === 'static') {
          panel.style.position = 'relative';
        }
        hd.style.paddingRight = '44px';
        panel.appendChild(handle);

        // Draggable
        panel.setAttribute('draggable', 'true');
        panel.style.transition = 'opacity 0.2s, outline 0.15s';

        const onDragStart = (e) => {
          dragEl.current = panel;
          handle.style.cursor = 'grabbing';
          setTimeout(() => { if (panel) panel.style.opacity = '0.4'; }, 0);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', '');
        };

        const onDragEnd = () => {
          panel.style.opacity = '1';
          panel.style.outline = '';
          handle.style.cursor = 'grab';
          dragEl.current = null;
        };

        const onDragOver = (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragEl.current && dragEl.current !== panel) {
            panel.style.outline = '2px dashed var(--teal)';
            panel.style.outlineOffset = '4px';
          }
        };

        const onDragLeave = () => {
          panel.style.outline = '';
          panel.style.outlineOffset = '';
        };

        const onDrop = (e) => {
          e.preventDefault();
          panel.style.outline = '';
          panel.style.outlineOffset = '';
          const from = dragEl.current;
          if (!from || from === panel) { dragEl.current = null; return; }

          const fromNext   = from.nextSibling;
          const fromParent = from.parentNode;
          const toNext     = panel.nextSibling;
          const toParent   = panel.parentNode;

          if (fromNext === panel) {
            toParent.insertBefore(from, toNext);
          } else {
            toParent.insertBefore(from, panel);
            if (fromParent) fromParent.insertBefore(panel, fromNext);
          }

          from.style.outline = '2px solid var(--teal)';
          from.style.outlineOffset = '4px';
          setTimeout(() => {
            from.style.outline = '';
            from.style.outlineOffset = '';
          }, 600);

          dragEl.current = null;
        };

        panel.addEventListener('dragstart', onDragStart);
        panel.addEventListener('dragend',   onDragEnd);
        panel.addEventListener('dragover',  onDragOver);
        panel.addEventListener('dragleave', onDragLeave);
        panel.addEventListener('drop',      onDrop);

        // Cleanup kaydı
        cleanupFns.current.push(() => {
          panel.removeEventListener('dragstart', onDragStart);
          panel.removeEventListener('dragend',   onDragEnd);
          panel.removeEventListener('dragover',  onDragOver);
          panel.removeEventListener('dragleave', onDragLeave);
          panel.removeEventListener('drop',      onDrop);
          handle.removeEventListener('mouseover', onOver);
          handle.removeEventListener('mouseout',  onOut);
          handle.remove();
          hd.style.paddingRight = '';
        });
      });

      // İlk açılış ipucu
      if (!window._widgetTipGosterildi) {
        window._widgetTipGosterildi = true;
        setTimeout(() => {
          const toast = document.getElementById('toastEl');
          if (toast) {
            toast.textContent = '⠿ ikonunu sürükleyerek panelleri taşıyabilirsiniz';
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
              toast.style.opacity = '0';
              toast.style.transform = 'translateX(-50%) translateY(80px)';
            }, 2800);
          }
        }, 800);
      }
    };

    // DOM hazır olunca init et
    const timer = setTimeout(init, 350);

    return () => {
      clearTimeout(timer);
      cleanupFns.current.forEach(fn => fn());
      cleanupFns.current = [];
    };
  }, []); // Sadece mount'ta çalış
}
