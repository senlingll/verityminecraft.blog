(() => {
  const links = document.querySelectorAll('[data-download-gate]');
  const status = document.querySelector('[data-download-status]');

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
      link.textContent = `Opening source in ${seconds}s`;

      if (status) {
        status.textContent = `Confirming source: ${href}`;
      }

      const timer = window.setInterval(() => {
        seconds -= 1;
        link.textContent = `Opening source in ${seconds}s`;

        if (seconds <= 0) {
          window.clearInterval(timer);
          link.textContent = originalText;
          link.removeAttribute('aria-disabled');
          link.dataset.counting = 'false';
          window.open(href, '_blank', 'noopener,noreferrer');

          if (status) {
            status.textContent = 'Source opened in a new tab. Check platform, version, and file type before downloading.';
          }
        }
      }, 1000);
    });
  });
})();
