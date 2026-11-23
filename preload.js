const { ipcRenderer } = require('electron');

if (process.isMainFrame && location.protocol === 'http:') {
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reportAppearance = () => {
      ipcRenderer.send('ariadne:color-scheme', root.dataset.colorScheme ?? 'light');
    };
    new MutationObserver(reportAppearance).observe(root, { attributeFilter: ['data-color-scheme'] });
    reportAppearance();
  }, { once: true });
}
