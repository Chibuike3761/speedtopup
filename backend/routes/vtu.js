const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

const API_KEY = process.env.VTU_API_KEY;
const BASE_URL = process.env.VTU_BASE_URL || 'https://vtu.ng/api';

router.post('/buy-data', auth, async (req, res) => {
  const { network, phone, amount } = req.body;

  if (!network || !phone || !amount) {
    return res.status(400).json({ error: "Network, phone number and amount (in GB) are required" });
  }

  try {
    // VTU.ng Data Purchase (common format - adjust if your dashboard shows different)
    const url = `${BASE_URL}/data`;   // or /buy-data depending on their exact endpoint

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network: network.toUpperCase(),   // MTN, AIRTEL, GLO, 9MOBILE
        phone: phone,
        amount: parseInt(amount),         // GB amount
        // plan_type: "SME"               // Add if needed (SME, CG, etc.)
      })
    });

    const data = await response.json();

    if (data.status === "success" || response.ok) {
      res.json({
        success: true,
        message: `✅ ${amount}GB ${network} data successfully delivered to ${phone}`,
        transactionId: data.order_id || data.transaction_id || 'TX-' + Date.now(),
        providerResponse: data
      });
    } else {
      res.status(400).json({ 
        error: data.message || data.error || "Purchase failed. Check your VTU wallet balance." 
      });
    }

  } catch (error) {
    console.error("VTU.ng Error:", error);
    res.status(500).json({ 
      error: "Failed to connect to VTU provider. Please try again." 
    });
  }
});

module.exports = router;