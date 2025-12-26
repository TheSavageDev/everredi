// Auto-set Authorization header if token exists
const token = pm.environment.get("firebase_token");
if (token) {
    pm.request.headers.add({
        key: "Authorization",
        value: `Bearer ${token}`
    });
}

// Extract user ID from token (JWT decode)
if (token) {
    try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        pm.environment.set("user_id", payload.user_id || payload.uid);
    } catch (e) {
        // Token decode failed, ignore
    }
}

