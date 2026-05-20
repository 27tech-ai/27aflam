// Invitation Code Management System
// 7 days in milliseconds
const INVITATION_VALIDITY = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'invitation_code';
const COOKIE_TIME_NAME = 'invitation_time';

class InvitationManager {
    constructor() {
        this.modal = null;
        this.invitationCodes = [];
        this.init();
    }

    async init() {
        // Load invitation codes from JSON
        await this.loadCodes();
        
        // Check if user has valid invitation
        if (!this.isValidInvitation()) {
            this.showModal();
        }
    }

    async loadCodes() {
        try {
            const response = await fetch('/data/invitation.json');
            const data = await response.json();
            this.invitationCodes = data.codes.filter(c => c.active);
        } catch (error) {
            console.error('Failed to load invitation codes:', error);
        }
    }

    isValidInvitation() {
        const code = this.getCookie(COOKIE_NAME);
        const time = this.getCookie(COOKIE_TIME_NAME);

        if (!code || !time) {
            return false;
        }

        // Check if code is still in the valid codes list
        const isValidCode = this.invitationCodes.some(c => c.code === code);
        if (!isValidCode) {
            return false;
        }

        // Check if 7 days have passed
        const savedTime = parseInt(time);
        const currentTime = Date.now();
        const elapsedTime = currentTime - savedTime;

        if (elapsedTime > INVITATION_VALIDITY) {
            // Code has expired, clear cookies
            this.clearCookies();
            return false;
        }

        return true;
    }

    showModal() {
        if (!this.modal) {
            this.createModal();
        }
        this.modal.style.display = 'flex';
        // Disable body scrolling
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        // Enable body scrolling
        document.body.style.overflow = '';
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'invitation-modal';
        this.modal.className = 'invitation-modal';
        
        const now = new Date();
        const expiryDate = new Date(now.getTime() + INVITATION_VALIDITY);
        const expiryDateStr = expiryDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        this.modal.innerHTML = `
            <div class="invitation-modal-content">
                <div class="invitation-modal-header">
                    <h2>Welcome to 27AFLAM</h2>
                    <p>Enter your invitation code to access the site</p>
                </div>
                <div class="invitation-modal-body">
                    <form id="invitation-form">
                        <div class="form-group">
                            <label for="invitation-code">Invitation Code</label>
                            <input 
                                type="text" 
                                id="invitation-code" 
                                name="code" 
                                placeholder="Enter your code"
                                autocomplete="off"
                                required
                            >
                            <small class="invitation-help">Your code will be valid until ${expiryDateStr}</small>
                        </div>
                        <button type="submit" class="btn-primary invitation-submit">Enter Site</button>
                        <div id="invitation-error" class="invitation-error"></div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Add event listeners
        const form = this.modal.querySelector('#invitation-form');
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        const input = document.getElementById('invitation-code');
        const code = input.value.trim().toUpperCase();
        const errorDiv = document.getElementById('invitation-error');

        // Clear previous error
        errorDiv.textContent = '';

        // Validate code
        const isValidCode = this.invitationCodes.some(c => c.code === code);

        if (!isValidCode) {
            errorDiv.textContent = '❌ Invalid code. Please try again.';
            input.value = '';
            input.focus();
            return;
        }

        // Save code to cookies
        this.setCookie(COOKIE_NAME, code, INVITATION_VALIDITY);
        this.setCookie(COOKIE_TIME_NAME, Date.now().toString(), INVITATION_VALIDITY);

        // Success message
        errorDiv.style.color = '#28a745';
        errorDiv.textContent = '✅ Code verified! Accessing site...';
        
        // Wait a moment then close modal
        setTimeout(() => {
            this.hideModal();
            input.value = '';
        }, 800);
    }

    setCookie(name, value, maxAge) {
        const date = new Date();
        date.setTime(date.getTime() + maxAge);
        const expires = 'expires=' + date.toUTCString();
        document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
    }

    getCookie(name) {
        const nameEQ = name + '=';
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.indexOf(nameEQ) === 0) {
                return cookie.substring(nameEQ.length);
            }
        }
        return null;
    }

    clearCookies() {
        document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        document.cookie = `${COOKIE_TIME_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.invitationManager = new InvitationManager();
    });
} else {
    window.invitationManager = new InvitationManager();
}
