const fetch = require("node-fetch");

exports.handler = async (event) => {
  const {
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  } = process.env;

  const body = JSON.parse(event.body);

  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}` }
  });

  const token = (await tokenRes.json()).access_token;

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14);

  const password = Buffer.from(
    MPESA_SHORTCODE + MPESA_PASSKEY + timestamp
  ).toString("base64");

  const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",{
    method:"POST",
    headers:{
      Authorization:`Bearer ${token}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      BusinessShortCode:MPESA_SHORTCODE,
      Password:password,
      Timestamp:timestamp,
      TransactionType:"CustomerPayBillOnline",
      Amount:body.amount,
      PartyA:body.phone,
      PartyB:MPESA_SHORTCODE,
      PhoneNumber:body.phone,
      CallBackURL:MPESA_CALLBACK_URL,
      AccountReference:"NairobiSweets",
      TransactionDesc:"Payment"
    })
  });

  const data=await stkRes.json();

  await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments`,{
    method:"POST",
    headers:{
      apikey:SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      profile_id:body.profile_id,
      phone:body.phone,
      amount:body.amount,
      checkout_request_id:data.CheckoutRequestID,
      status:"pending"
    })
  });

  return {
    statusCode:200,
    body:JSON.stringify(data)
  };
};
