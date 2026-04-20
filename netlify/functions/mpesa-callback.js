exports.handler = async (event) => {
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY} = process.env;

  const body = JSON.parse(event.body);
  const cb = body.Body.stkCallback;

  const id = cb.CheckoutRequestID;
  const success = cb.ResultCode === 0;

  await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments?checkout_request_id=eq.${id}`,{
    method:"PATCH",
    headers:{
      apikey:SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      status: success ? "paid":"failed",
      callback_payload:body
    })
  });

  if(success){
    const payment = await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments?checkout_request_id=eq.${id}`)
      .then(r=>r.json()).then(d=>d[0]);

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${payment.profile_id}`,{
      method:"PATCH",
      headers:{
        apikey:SUPABASE_SERVICE_ROLE_KEY,
        Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        is_active:true,
        payment_status:"paid"
      })
    });
  }

  return {statusCode:200,body:"ok"};
};
