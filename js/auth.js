/* =====================================================================
   FloMatrix — FRONTEND-ONLY AUTH ENGINE (NO BACKEND REQUIRED)
   ---------------------------------------------------------------------
   - Stores users in localStorage ("fm_users")
   - Stores current token in "fm_auth_token"
   - Stores current user in "fm_user"
   - Seeds a default demo account:
       email:    demo@flomatrix.trade
       password: demo123
       username: Demo Trader
   ===================================================================== */

window.fmAuth = (function () {

    const TOKEN_KEY = "fm_auth_token";
    const USER_KEY  = "fm_user";
    const USERS_KEY = "fm_users";

    // Seed default demo user if none exist yet
    function seedDemoUser() {
        const existing = _getUsers();
        if (existing && existing.length > 0) return;

        const demo = {
            email: "demo@flomatrix.trade",
            password: "demo123",
            username: "Demo Trader",
            createdAt: new Date().toISOString()
        };
        localStorage.setItem(USERS_KEY, JSON.stringify([demo]));
        console.log("fmAuth: seeded demo user demo@flomatrix.trade / demo123");
    }

    // --------------------------------------------------------------
    // UTIL: USERS LIST
    // --------------------------------------------------------------
    function _getUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY);
            if (!raw) return [];
            return JSON.parse(raw) || [];
        } catch {
            return [];
        }
    }

    function _saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
    }

    // --------------------------------------------------------------
    // STATE
    // --------------------------------------------------------------
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function isLoggedIn() {
        return !!getToken();
    }

    function saveLogin(token, userObj) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        // send back to login page
        window.location.href = "/auth/login.html";
    }

    // --------------------------------------------------------------
    // FRONTEND-ONLY LOGIN
    // --------------------------------------------------------------
    async function login(email, password) {
        email = (email || "").trim().toLowerCase();
        password = (password || "").trim();

        if (!email || !password) {
            throw new Error("Please enter email and password.");
        }

        const users = _getUsers();
        const found = users.find(u => u.email.toLowerCase() === email);

        if (!found || found.password !== password) {
            throw new Error("Invalid email or password.");
        }

        const user = {
            email: found.email,
            username: found.username || found.email.split("@")[0],
            createdAt: found.createdAt
        };

        // simple local token
        const token = "local-" + btoa(user.email + "|" + Date.now());
        saveLogin(token, user);
        return { token, user };
    }

    // --------------------------------------------------------------
    // FRONTEND-ONLY REGISTRATION
    // --------------------------------------------------------------
    async function register(email, password, username) {
        email = (email || "").trim().toLowerCase();
        password = (password || "").trim();
        username = (username || "").trim();

        if (!email || !password || !username) {
            throw new Error("Please fill all fields.");
        }

        let users = _getUsers();
        if (users.find(u => u.email.toLowerCase() === email)) {
            throw new Error("An account with that email already exists.");
        }

        const newUser = {
            email,
            password,
            username,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        _saveUsers(users);

        const token = "local-" + btoa(email + "|" + Date.now());
        const user = { email, username, createdAt: newUser.createdAt };
        saveLogin(token, user);
        return { token, user };
    }

    // --------------------------------------------------------------
    // ROUTE GUARD
    // --------------------------------------------------------------
    function requireAuth() {
        if (!isLoggedIn()) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = "/auth/login.html?next=" + next;
        }
    }

    // --------------------------------------------------------------
    // INIT
    // --------------------------------------------------------------
    seedDemoUser();

    // --------------------------------------------------------------
    // EXPORT
    // --------------------------------------------------------------
    return {
        getToken,
        getUser,
        isLoggedIn,
        saveLogin,
        logout,
        login,
        register,
        requireAuth,
    };

})();
