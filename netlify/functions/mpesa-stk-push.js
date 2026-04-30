exports.handler = async (event) => {
  try {
    const {
      phone,
      amount,
      profile_id
    } = JSON.parse(event.body);

    if (!phone || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Phone and amount required"
        })
      };
    }

    // Format phone number
    let formattedPhone = phone.replace(/\D/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.substring(1);
    }

    if (!formattedPhone.startsWith("254")) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid Kenyan phone number"
        })
      };
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    // Access token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const tokenData = await tokenRes.json();

    const accessToken = tokenData.access_token;

    // Timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    // STK Push request
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
          AccountReference: profile_id || "NairobiSweets",
          TransactionDesc: "Nairobi Sweets Profile Payment"
        })
      }
    );

    const stkData = await stkRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify(stkData)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};
