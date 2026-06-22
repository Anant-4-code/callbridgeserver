// get-refresh-token.js

const https = require('https');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const AUTH_CODE = 'YOUR_AUTH_CODE'; // Replace with your one-time auth code
const REDIRECT_URI = 'http://localhost';

const postData = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  code: AUTH_CODE,
  grant_type: 'authorization_code',
  redirect_uri: REDIRECT_URI
}).toString();

const options = {
  hostname: 'oauth2.googleapis.com',
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔄 Exchanging authorization code for refresh token...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📝 Response from Google:\n');
    console.log(data);
    console.log('\n');

    try {
      const tokens = JSON.parse(data);
      
      if (tokens.refresh_token) {
        console.log('✅ SUCCESS! Here is your REFRESH_TOKEN:\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(tokens.refresh_token);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📋 What to do next:\n');
        console.log('1. Go to: https://railway.app');
        console.log('2. Select CallBridge project → Variables');
        console.log('3. Update GOOGLE_REFRESH_TOKEN with the token above');
        console.log('4. Click Deploy\n');
        
        console.log('Additional tokens (if needed):\n');
        console.log('Access Token (valid 1 hour):', tokens.access_token);
        console.log('Expires in:', tokens.expires_in, 'seconds\n');
      } else if (tokens.error) {
        console.log('❌ Error:', tokens.error);
        console.log('Description:', tokens.error_description);
      } else {
        console.log('⚠️ Unexpected response - no refresh_token or error');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();