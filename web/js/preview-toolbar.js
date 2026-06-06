// Preview toolbar — switch mobile/desktop by reloading with ?preview=mobile
(function () {
    const params = new URLSearchParams(location.search);
    const isMobile = params.get('preview') === 'mobile';

    // Inject/update viewport meta
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = isMobile
        ? 'width=390, initial-scale=1'
        : 'width=device-width, initial-scale=1';

    // Build toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'preview-toolbar';
    toolbar.innerHTML = `
        <span class="preview-toolbar-label">View</span>
        <button class="ptb-btn desktop-btn${!isMobile ? ' active' : ''}" id="ptbDesktop">
            <i class="fa-solid fa-display"></i> Desktop
        </button>
        <button class="ptb-btn mobile-btn${isMobile ? ' active' : ''}" id="ptbMobile">
            <i class="fa-solid fa-mobile-screen"></i> Mobile
        </button>
        <button class="ptb-btn-reset" id="ptbReset">Reset</button>
    `;
    document.body.appendChild(toolbar);

    function goTo(mode) {
        const u = new URL(location.href);
        if (mode === 'mobile') u.searchParams.set('preview', 'mobile');
        else u.searchParams.delete('preview');
        location.replace(u.toString());
    }

    document.getElementById('ptbDesktop').addEventListener('click', () => goTo('desktop'));
    document.getElementById('ptbMobile').addEventListener('click', () => goTo('mobile'));
    document.getElementById('ptbReset').addEventListener('click', () => goTo('desktop'));
})();
