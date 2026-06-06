(function () {
    const isMobile = new URLSearchParams(location.search).get('preview') === 'mobile';
    // If we're inside the iframe, don't inject toolbar again
    if (window.self !== window.top) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'preview-toolbar';
    toolbar.innerHTML = `
        <span class="preview-toolbar-label">View</span>
        <button class="ptb-btn desktop-btn${!isMobile ? ' active' : ''}" id="ptbDesktop"><i class="fa-solid fa-display"></i> Desktop</button>
        <button class="ptb-btn mobile-btn${isMobile ? ' active' : ''}" id="ptbMobile"><i class="fa-solid fa-mobile-screen"></i> Mobile</button>
        <button class="ptb-btn-reset" id="ptbReset">Reset</button>
    `;
    document.body.appendChild(toolbar);

    // Mobile mode: wrap page in iframe at 390px
    function goMobile() {
        const src = location.href.includes('?preview=mobile') ? location.href : location.href + (location.search ? '&' : '?') + 'preview=mobile';
        // Open in iframe overlay
        const overlay = document.createElement('div');
        overlay.id = 'mobileOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
        const frame = document.createElement('iframe');
        frame.src = src;
        frame.style.cssText = 'width:390px;height:844px;border:none;border-radius:16px;box-shadow:0 0 0 8px #222,0 0 0 10px #333;flex-shrink:0;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Thoát Mobile Preview';
        closeBtn.style.cssText = 'background:#222;border:1px solid #444;color:#fff;padding:8px 20px;border-radius:99px;cursor:pointer;font-size:13px;';
        closeBtn.onclick = () => { overlay.remove(); document.getElementById('ptbDesktop').classList.add('active'); document.getElementById('ptbMobile').classList.remove('active'); };
        overlay.appendChild(frame);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }

    document.getElementById('ptbDesktop').addEventListener('click', () => {
        document.getElementById('mobileOverlay')?.remove();
        document.getElementById('ptbDesktop').classList.add('active');
        document.getElementById('ptbMobile').classList.remove('active');
    });
    document.getElementById('ptbMobile').addEventListener('click', goMobile);
    document.getElementById('ptbReset').addEventListener('click', () => {
        document.getElementById('mobileOverlay')?.remove();
        document.getElementById('ptbDesktop').classList.add('active');
        document.getElementById('ptbMobile').classList.remove('active');
    });
})();
