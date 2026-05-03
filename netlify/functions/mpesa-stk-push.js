exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const phone = String(body.phone || "").replace(/\D/g, "");
    const amount = Number(body.amount || 0);
    const profile_id = body.profile_id || null;
    const packageName = body.package || "Featured";

    if (!phone || !amount) {
      return response(400, { error: "Phone and amount required" });
    }

    let formattedPhone = phone;
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1);
    if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) formattedPhone = "254" + formattedPhone;

    const token = await getMpesaToken();
    const timestamp = getTimestamp();

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const stkRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: profile_id || "NairobiSweets",
        TransactionDesc: `Nairobi Sweets ${packageName}`
      })
    });

    const stkData = await stkRes.json();

    return response(200, {
      success: true,
      profile_id,
      package: packageName,
      mpesa: stkData
    });

  } catch (error) {
    return response(500, { error: error.message });
  }
};

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}` }
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Could not get M-Pesa token");
  return data.access_token;
}

function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
