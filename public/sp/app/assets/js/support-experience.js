(function () {
  window.spSupportView = function (view) {
    ['help', 'contact', 'requests'].forEach(function (name) {
      var panel = document.getElementById('supportPanel-' + name);
      var tab = document.getElementById('supportTab-' + name);
      if (panel) panel.hidden = name !== view;
      if (tab) {
        tab.setAttribute('aria-selected', String(name === view));
        tab.tabIndex = name === view ? 0 : -1;
      }
    });
    if (view === 'requests' && window.spLoadSupportRequests) window.spLoadSupportRequests();
  };

  function initSupportListeners() {
    var tabs = Array.from(document.querySelectorAll('.support-tab'));
    tabs.forEach(function (tab, index) {
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        var next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        if (next) { next.click(); next.focus(); }
      });
    });

    var searchInput = document.getElementById('supportSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function (event) {
        var query = (event.target.value || '').trim().toLowerCase();
        var matches = 0;
        document.querySelectorAll('#faqList .faq-item').forEach(function (item) {
          var match = !query || item.textContent.toLowerCase().indexOf(query) !== -1;
          item.hidden = !match;
          if (match) matches++;
        });
        var noResults = document.getElementById('supportNoResults');
        if (noResults) noResults.hidden = matches > 0;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportListeners);
  } else {
    initSupportListeners();
  }
})();
