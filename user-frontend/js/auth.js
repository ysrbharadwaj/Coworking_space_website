let currentTab = 'login';

function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${tab}-form`).classList.add('active');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    if (!validateForm(form)) {
        return;
    }
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    const submitBtn = form.querySelector('.auth-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            saveSession('currentUser', result.data);
            saveToken(result.token);
            localStorage.setItem('currentUser', JSON.stringify(result.data));
            if (rememberMe) {
                localStorage.setItem('rememberUser', email);
            }
            
            showToast('Login successful! Redirecting...', 'success');

            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        } else {
            showToast(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    if (!validateForm(form)) {
        return;
    }
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const agreeTerms = document.getElementById('agree-terms').checked;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showToast('Please agree to the Terms & Conditions', 'error');
        return;
    }
    
    const submitBtn = form.querySelector('.auth-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, phone, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Registration successful! Please login...', 'success');

            setTimeout(() => {
                switchTab('login');
                document.querySelector('.auth-tab').click();
                document.getElementById('login-email').value = email;
                document.getElementById('login-password').focus();
            }, 1500);
        } else {
            showToast(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function socialLogin(provider) {
    if (provider === 'facebook') {
        showToast('Facebook login coming soon!', 'info');
    }
}

function initializeGoogleSignIn() {
    if (typeof google === 'undefined' || !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        console.warn('Google Sign-In not configured. Please set GOOGLE_CLIENT_ID in config.js');
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: false
    });

    const authCard = document.querySelector('.auth-card');
    const cardWidth = authCard ? authCard.offsetWidth - 80 : 370;

    const loginButton = document.getElementById('google-signin-button-login');
    if (loginButton) {
        google.accounts.id.renderButton(
            loginButton,
            { 
                theme: 'outline',
                size: 'large',
                width: cardWidth,
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        );
    }

    const registerButton = document.getElementById('google-signin-button-register');
    if (registerButton) {
        google.accounts.id.renderButton(
            registerButton,
            { 
                theme: 'outline',
                size: 'large',
                width: cardWidth,
                text: 'signup_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        );
    }
}

async function handleGoogleCallback(response) {
    const idToken = response.credential;

    showToast('Signing in with Google...', 'info');
    
    try {
        const apiResponse = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: idToken })
        });
        
        const result = await apiResponse.json();
        
        if (result.success) {
            saveSession('currentUser', result.data);
            saveToken(result.token);
            localStorage.setItem('currentUser', JSON.stringify(result.data));
            
            showToast('Google sign-in successful! Redirecting...', 'success');

            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        } else {
            showToast(result.error || 'Google sign-in failed', 'error');
        }
    } catch (error) {
        console.error('Google sign-in error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

function checkAuthStatus() {
    const currentUser = getSession('currentUser');
    const token = getToken();
    if (currentUser && token) {
        window.location.href = 'home.html';
        return true;
    }

    const rememberedEmail = localStorage.getItem('rememberUser');
    if (rememberedEmail) {
        document.getElementById('login-email').value = rememberedEmail;
        document.getElementById('remember-me').checked = true;
    }
    
    return false;
}

function logout() {
    clearToken();
    clearSession('currentUser');
    clearSession('pendingBooking');
    clearSession('confirmedBooking');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('transactions');
    showToast('Logged out successfully', 'success');
    setTimeout(() => { window.location.href = 'auth.html'; }, 800);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuthStatus()) {
        setupFormValidation();

        if (typeof google !== 'undefined') {
            initializeGoogleSignIn();
        } else {
            window.addEventListener('load', () => {
                if (typeof google !== 'undefined') {
                    initializeGoogleSignIn();
                }
            });
        }
    }
});

function setupFormValidation() {
    const confirmPassword = document.getElementById('register-confirm');
    if (confirmPassword) {
        confirmPassword.addEventListener('input', function() {
            const password = document.getElementById('register-password').value;
            if (this.value && this.value !== password) {
                this.setCustomValidity('Passwords do not match');
            } else {
                this.setCustomValidity('');
            }
        });
    }
    
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !emailRegex.test(this.value)) {
                this.setCustomValidity('Please enter a valid email address');
            } else {
                this.setCustomValidity('');
            }
        });
    });
}

window.authFunctions = {
    logout,
    checkAuthStatus,
    getCurrentUser: () => getSession('currentUser')
};
