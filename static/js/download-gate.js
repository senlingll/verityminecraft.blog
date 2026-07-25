(() => {
  const links = document.querySelectorAll('[data-download-gate]');
  const status = document.querySelector('[data-download-status]');
  const i18n = window.DownloadGateI18n || {};
  const format = (template, values = {}) =>
    String(template || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  const openingTemplate = i18n.opening || 'Opening source in {seconds}s';
  const confirmingTemplate = i18n.confirming || 'Confirming source: {url}';
  const openedText = i18n.opened || 'Source opened in a new tab. Check platform, version, and file type before downloading.';

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('/')) {
        return;
      }

      event.preventDefault();

      if (link.dataset.counting === 'true') {
        return;
      }

      const originalText = link.dataset.downloadLabel || link.textContent.trim();
      let seconds = 15;
      link.dataset.counting = 'true';
      link.setAttribute('aria-disabled', 'true');
      link.textContent = format(openingTemplate, { seconds });

      if (status) {
        status.textContent = format(confirmingTemplate, { url: href });
      }

      const timer = window.setInterval(() => {
        seconds -= 1;
        link.textContent = format(openingTemplate, { seconds });

        if (seconds <= 0) {
          window.clearInterval(timer);
          link.textContent = originalText;
          link.removeAttribute('aria-disabled');
          link.dataset.counting = 'false';
          window.open(href, '_blank', 'noopener,noreferrer');

          if (status) {
            status.textContent = openedText;
          }
        }
      }, 1000);
    });
  });
})();
