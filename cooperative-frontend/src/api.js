// src/api.js

export async function fetchWithAuth(url, options = {}) {
  let accessToken = localStorage.getItem('access_token');

  // Setup the standard headers with the current Access Token
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Make the initial request
  let response = await fetch(url, { ...options, headers });

  // INTERCEPT: If the token is expired (401), trigger the refresh!
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      try {
        // Call your backend refresh route
        const refreshRes = await fetch('http://localhost:8000/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }) 
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          
          // Save the brand new token pair
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);

          // Retry the original request with the NEW access token
          headers['Authorization'] = `Bearer ${data.access_token}`;
          response = await fetch(url, { ...options, headers });
          
        } else {
          // The refresh token is ALSO expired or invalid.
          localStorage.clear();
          window.location.href = '/';
        }
      } catch (error) {
        localStorage.clear();
        window.location.href = '/';
      }
    } else {
      // No refresh token found.
      localStorage.clear();
      window.location.href = '/';
    }
  }

  return response;
}