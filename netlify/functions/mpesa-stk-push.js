exports.handler = async (event) => {
  try {
    const {
      phone,
      amount,
      account_reference = "NairobiSweets",
      transaction_desc = "Payment"
    } = JSON.parse(event.body || "{}");

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing required M-Pesa environment variables"
        })
      };
    }

    if (!phone || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "phone and amount are required"
        })
      };
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to get access token",
          details: tokenData
        })
      };
    }

    const accessToken = tokenData.access_token;

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const formattedPhone = String(phone).trim().replace(/^0/, "254");

    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Number(amount),
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: callbackUrl,
          AccountReference: account_reference,
          TransactionDesc: transaction_desc
        })
      }
    );

    const stkData = await stkRes.json();

    return {
      statusCode: stkRes.ok ? 200 : 500,
      body: JSON.stringify(stkData)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "STK push failed"
      })
    };
  }
};
