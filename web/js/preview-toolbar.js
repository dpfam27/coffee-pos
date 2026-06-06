(function () {
    // Inside iframe — add ?preview=mobile to all navigations so it persists
    if (window.self !== window.top) {
        // Intercept all link/form navigations inside iframe to keep ?preview=mobile
        function addParam(url) {
            try {
                const u = new URL(url, location.href);
                u.searchParams.set('preview', 'mobile');
                return u.toString();
            } catch(e) { return url; }
        }

        // Patch location.href assignments via pushState/replaceState
        const origAssign   = location.assign.bind(location);
        const origReplace  = location.replace.bind(location);
        location.assign  = url => origAssign(addParam(url));
        location.replace = url => origReplace(addParam(url));

        // Intercept anchor clicks
        document.addEventListener('click', function(e) {
            const a = e.target.closest('a[href]');
            if (a && !a.href.includes('preview=mobile')) {
                e.preventDefault();
                location.href = addParam(a.href);
            }
        }, true);

        // Intercept form submits
        document.addEventListener('submit', function(e) {
            const f = e.target;
            if (f.method === 'get' || !f.method) {
                const u = new URL(f.action || location.href, location.href);
                u.searchParams.set('preview', 'mobile');
                f.action = u.toString();
            }
        }, true);

        // Intercept window.location.href = ... (used by JS redirects like after login)
        const origHref = Object.getOwnPropertyDescriptor(window.location, 'href');
        try {
            Object.defineProperty(window.location, 'href', {
                set(url) { origAssign(addParam(url)); },
                get() { return location.toString(); }
            });
        } catch(e) {}

        // Add a small "← Desktop" button floating at top of iframe content
        window.addEventListener('DOMContentLoaded', function() {
            const btn = document.createElement('button');
            btn.textContent = '← Desktop';
            btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:#1a1815;border:1px solid rgba(255,255,255,.15);color:#9a8f82;font-size:11px;padding:5px 10px;border-radius:99px;cursor:pointer;';
            btn.addEventListener('click', function() {
                // Tell parent to exit mobile mode
                window.top.postMessage('exitMobile', '*');
            });
            document.body.appendChild(btn);
        });
        return;
    }

    // ── PARENT PAGE ──────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'preview-toolbar';
    toolbar.innerHTML = `
        <span class="preview-toolbar-label">View</span>
        <button class="ptb-btn desktop-btn active" id="ptbDesktop"><i class="fa-solid fa-display"></i> Desktop</button>
        <button class="ptb-btn mobile-btn" id="ptbMobile"><i class="fa-solid fa-mobile-screen"></i> Mobile</button>
        <button class="ptb-btn-reset" id="ptbReset">Reset</button>
    `;
    document.body.appendChild(toolbar);

    let overlay = null;

    function goMobile() {
        if (overlay) return;
        const src = (() => {
            const u = new URL(location.href);
            u.searchParams.set('preview', 'mobile');
            return u.toString();
        })();

        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';

        const frame = document.createElement('iframe');
        frame.src = src;
        frame.style.cssText = 'width:390px;height:780px;border:none;border-radius:20px;box-shadow:0 0 0 8px #1a1815,0 0 0 10px #333;flex-shrink:0;';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fa-solid fa-display"></i> Quay lại Desktop';
        closeBtn.style.cssText = 'background:#1a1815;border:1px solid rgba(255,255,255,.15);color:#f2ede6;padding:10px 24px;border-radius:99px;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;';
        closeBtn.onclick = exitMobile;

        overlay.appendChild(frame);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        document.getElementById('ptbMobile').classList.add('active');
        document.getElementById('ptbDesktop').classList.remove('active');
    }

    function exitMobile() {
        overlay?.remove();
        overlay = null;
        document.getElementById('ptbDesktop').classList.add('active');
        document.getElementById('ptbMobile').classList.remove('active');
    }

    // Listen for exitMobile message from iframe
    window.addEventListener('message', function(e) {
        if (e.data === 'exitMobile') exitMobile();
    });

    document.getElementById('ptbDesktop').addEventListener('click', exitMobile);
    document.getElementById('ptbMobile').addEventListener('click', goMobile);
    document.getElementById('ptbReset').addEventListener('click', exitMobile);
})();
