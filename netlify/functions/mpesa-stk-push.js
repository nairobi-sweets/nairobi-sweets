const axios = require("axios");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body);

    const phone = body.phone;
    const amount = body.amount || 1500;

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const shortcode = process.env.MPESA_SHORTCODE || "174379";

    const passkey =
      process.env.MPESA_PASSKEY ||
      "bfb279f9aa9bdbcf158e97ddf0f0d5e0f5f1d7f0d1b0c0";

    const auth = Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const tokenResponse = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("Access token generated");

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL:
        "https://nairobi-sweets.com/.netlify/functions/mpesa-callback",
      AccountReference: "NairobiSweets",
      TransactionDesc: "Profile Payment",
    };

    console.log("Sending STK push:", stkPayload);

    const stkResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("STK success:", stkResponse.data);

    return {
      statusCode: 200,
      body: JSON.stringify(stkResponse.data),
    };
  } catch (error) {
    console.log(
      "STK push error:",
      error.response?.data || error.message
    );

    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          error.response?.data || error.message,
      }),
    };
  }
};
