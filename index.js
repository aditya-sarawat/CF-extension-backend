require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIST_API_AUTH = process.env.CLIST_API_AUTH;
const PASSPHRASE = process.env.PASSPHRASE;

if (!CLIST_API_AUTH) {
  console.error("Error: CLIST_API_AUTH environment variable is not defined.");
  process.exit(1);
}

if (!PASSPHRASE) {
  console.error("Error: PASSPHRASE environment variable is not defined.");
  process.exit(1);
}

// Enable CORS for all requests (needed so the extension can query the backend)
app.use(cors());

// Middleware to parse JSON bodies if needed (optional for GET, but good practice)
app.use(express.json());

// Proxy endpoint
app.get('/api/contests', async (req, res) => {
  const requestPassphrase = req.headers['x-extension-passphrase'];

  // 1. Verify Passphrase
  if (!requestPassphrase || requestPassphrase !== PASSPHRASE) {
    console.warn(`[Unauthorized Access] Invalid or missing passphrase from IP: ${req.ip}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or missing passphrase." });
  }

  // 2. Build CLIST URL with forwarded query parameters
  const clistUrl = new URL("https://clist.by/api/v4/contest/");
  
  // Forward all query parameters (e.g., start__gt, order_by, resource__in)
  Object.keys(req.query).forEach(key => {
    clistUrl.searchParams.append(key, req.query[key]);
  });

  try {
    console.log(`[Proxy Request] Forwarding request to CLIST: ${clistUrl.toString()}`);
    
    const clistResponse = await fetch(clistUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': CLIST_API_AUTH,
        'Accept': 'application/json'
      }
    });

    if (!clistResponse.ok) {
      console.error(`[CLIST Error] API returned status ${clistResponse.status}`);
      return res.status(clistResponse.status).json({ 
        error: `CLIST API error (Status: ${clistResponse.status})` 
      });
    }

    const data = await clistResponse.json();
    res.json(data);
  } catch (error) {
    console.error("[Proxy Exception] Failed to fetch from CLIST API:", error);
    res.status(500).json({ error: "Internal Server Error: Failed to proxy request." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
  console.log(`Securing CLIST API key using passphrase protection.`);
});
