// =============================================================
// FILE : web/js/api.js
// DESC : Common Fetch API wrapper for POS Client
// =============================================================

const API_BASE_URL = '../api/';

const API = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        // Default options
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                // Keep credentials for sessions (session cookies)
            },
            ...options
        };
        
        // Include credentials for sessions
        defaultOptions.credentials = 'same-origin';

        try {
            const response = await fetch(url, defaultOptions);
            
            // Check for unauthorized access (401)
            if (response.status === 401 && !window.location.pathname.endsWith('index.html')) {
                // Clear session storage / local storage if any
                sessionStorage.clear();
                window.location.href = 'index.html';
                return;
            }
            
            // If response is not JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                return data;
            } else {
                const text = await response.text();
                return { success: response.ok, message: text };
            }
        } catch (error) {
            console.error('API Error:', error);
            throw new Error('Lỗi kết nối mạng: Vui lòng thử lại sau.');
        }
    },

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    async put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
