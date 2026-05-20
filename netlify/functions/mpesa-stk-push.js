const axios = require("axios");

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const phone = body.phone;
    const amount = body.amount || 1;

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    const password = Buffer.from(
      `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    // ACCESS TOKEN
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenRes = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const token = tokenRes.data.access_token;

    // STK PUSH
    const stkRes = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "NairobiSweets",
        TransactionDesc: "Profile Payment"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(stkRes.data)
    };

  } catch (err) {
    console.error(err.response?.data || err.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.response?.data || err.message
      })
    };
  }
};
