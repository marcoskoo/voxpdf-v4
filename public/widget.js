/**
 * VoxPDF v4 — Embeddable Widget
 * Include this script on any web page to embed the VoxPDF reader.
 *
 * Usage:
 *   <div id="voxpdf-widget" data-file="document.pdf"></div>
 *   <script src="https://your-domain.com/widget.js"></script>
 *
 * Or with custom options:
 *   <div id="voxpdf-widget"
 *        data-file="document.pdf"
 *        data-theme="dark"
 *        data-autoplay="false"
 *        data-lang="es"
 *        data-height="600px">
 *   </div>
 *   <script src="https://your-domain.com/widget.js"></script>
 */

(function () {
  'use strict';

  const WIDGET_BASE_URL = 'https://preview-voxpdf.space-z.ai';
  
  interface WidgetConfig {
    file?: string;
    theme?: string;
    autoplay?: boolean;
    lang?: string;
    height?: string;
    width?: string;
  }

  function init() {
    const container = document.getElementById('voxpdf-widget');
    if (!container) {
      console.warn('[VoxPDF] No #voxpdf-widget element found');
      return;
    }

    // Read config from data attributes
    const config: WidgetConfig = {
      file: container.dataset.file || '',
      theme: container.dataset.theme || 'dark',
      autoplay: container.dataset.autoplay === 'true',
      lang: container.dataset.lang || 'es',
      height: container.dataset.height || '600px',
      width: container.dataset.width || '100%',
    };

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'voxpdf-iframe';
    iframe.style.width = config.width || '100%';
    iframe.style.height = config.height || '600px';
    iframe.style.border = '1px solid rgba(124,106,245,0.2)';
    iframe.style.borderRadius = '12px';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('allow', 'microphone; clipboard-write; fullscreen');
    iframe.setAttribute('loading', 'lazy');

    // Build URL with params
    const params = new URLSearchParams({
      embed: 'true',
      theme: config.theme || 'dark',
      lang: config.lang || 'es',
      autoplay: config.autoplay ? '1' : '0',
    });
    if (config.file) params.set('file', config.file);

    iframe.src = `${WIDGET_BASE_URL}/?${params.toString()}`;
    
    // Replace container contents with iframe
    container.innerHTML = '';
    container.appendChild(iframe);

    // Listen for messages from iframe
    window.addEventListener('message', (e) => {
      if (e.data?.source !== 'voxpdf') return;
      switch (e.data.type) {
        case 'ready':
          console.log('[VoxPDF] Widget ready');
          break;
        case 'playing':
          container.dispatchEvent(new CustomEvent('voxpdf:playing', { detail: e.data }));
          break;
        case 'paused':
          container.dispatchEvent(new CustomEvent('voxpdf:paused', { detail: e.data }));
          break;
        case 'progress':
          container.dispatchEvent(new CustomEvent('voxpdf:progress', { detail: e.data }));
          break;
      }
    });

    // Expose API on container
    (container as any).voxpdf = {
      play: () => iframe.contentWindow?.postMessage({ source: 'host', type: 'play' }, '*'),
      pause: () => iframe.contentWindow?.postMessage({ source: 'host', type: 'pause' }, '*'),
      next: () => iframe.contentWindow?.postMessage({ source: 'host', type: 'next' }, '*'),
      prev: () => iframe.contentWindow?.postMessage({ source: 'host', type: 'prev' }, '*'),
      jumpTo: (idx: number) => iframe.contentWindow?.postMessage({ source: 'host', type: 'jumpTo', idx }, '*'),
      setTheme: (theme: string) => iframe.contentWindow?.postMessage({ source: 'host', type: 'setTheme', theme }, '*'),
      loadFile: (url: string) => iframe.contentWindow?.postMessage({ source: 'host', type: 'loadFile', url }, '*'),
    };
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
