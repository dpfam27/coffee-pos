// Preview toolbar — switch between mobile (390px) and desktop view
(function () {
    const toolbar = document.createElement('div');
    toolbar.className = 'preview-toolbar';
    toolbar.innerHTML = `
        <span class="preview-toolbar-label">View</span>
        <button class="ptb-btn desktop-btn active" id="ptbDesktop">
            <i class="fa-solid fa-display"></i> Desktop
        </button>
        <button class="ptb-btn mobile-btn" id="ptbMobile">
            <i class="fa-solid fa-mobile-screen"></i> Mobile
        </button>
        <button class="ptb-btn-reset" id="ptbReset">Reset</button>
    `;
    document.body.appendChild(toolbar);

    const html = document.documentElement;
    const btnD = document.getElementById('ptbDesktop');
    const btnM = document.getElementById('ptbMobile');
    const btnR = document.getElementById('ptbReset');

    function setDesktop() {
        html.classList.remove('preview-mobile');
        btnD.classList.add('active');
        btnM.classList.remove('active');
        localStorage.setItem('previewMode', 'desktop');
    }

    function setMobile() {
        html.classList.add('preview-mobile');
        btnM.classList.add('active');
        btnD.classList.remove('active');
        localStorage.setItem('previewMode', 'mobile');
    }

    function reset() {
        setDesktop();
        localStorage.removeItem('previewMode');
    }

    btnD.addEventListener('click', setDesktop);
    btnM.addEventListener('click', setMobile);
    btnR.addEventListener('click', reset);

    // Restore last mode
    if (localStorage.getItem('previewMode') === 'mobile') setMobile();
})();
