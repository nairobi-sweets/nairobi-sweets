const axios = require("axios");

function makeTimestamp() {
  const parts = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;

  return (
    get("year") +
    get("month") +
    get("day") +
    get("hour") +
    get("minute") +
    get("second")
  );
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body);

    const phone = body.phone;
    const amount = Number(body.amount || 1);

    if (!phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Phone number required" })
      };
    }

    const shortcode =
      process.env.MPESA_SHORTCODE || "174379";

    const passkey =
      process.env.MPESA_PASSKEY ||
      "bfb279f9aa9bdbcf158e97ddf0f5d6f9fdddc0b83b279b0d2f6e4d7b6f0b5c4b";

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const environment =
      process.env.MPESA_ENVIRONMENT || "sandbox";

    const baseURL =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    console.log("MPESA ENV:", environment);
    console.log("SHORTCODE:", shortcode);

    // ACCESS TOKEN
    const auth = Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const tokenResponse = await axios.get(
      `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("Access token generated");

    // PASSWORD
    const timestamp = makeTimestamp();

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    // STK PUSH
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
      TransactionDesc: "Profile Payment"
    };

    console.log("Sending STK push:", stkPayload);

    const stkResponse = await axios.post(
      `${baseURL}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log("STK SUCCESS:", stkResponse.data);

    return {
      statusCode: 200,
      body: JSON.stringify(stkResponse.data)
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
          error.response?.data?.errorMessage ||
          error.message
      })
    };
  }
};
