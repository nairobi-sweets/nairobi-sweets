const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.URL || "https://nairobi-sweets.com";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cleanPhone(phone){
  let p = String(phone || "").replace(/\D/g,"");
  if(!p) return "";
  if(p.startsWith("0")) p = "254" + p.slice(1);
  if(p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

function planAmount(plan){
  const p = String(plan || "").toLowerCase();
  if(p.includes("signature") || p.includes("vvip")) return 3000;
  if(p.includes("vip")) return 1500;
  if(p.includes("featured")) return 1000;
  return 1500;
}

exports.handler = async () => {
  try{
    if(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
      return {
        statusCode:500,
        body:JSON.stringify({
          ok:false,
          message:"Missing Supabase environment variables"
        })
      };
    }

    const since =
      new Date(Date.now() - 48 * 60 * 60 * 1000)
        .toISOString();

    const { data:failed, error } = await sb
      .from("payment_requests")
      .select("*")
      .eq("status","failed")
      .gte("updated_at",since)
      .order("updated_at",{ascending:false})
      .limit(25);

    if(error) throw error;

    const results = [];

    for(const item of failed || []){
      const profileId = item.profile_id;
      const phone = cleanPhone(item.phone);
      const plan = item.plan || item.package || "vip";
      const amount = Number(item.amount || planAmount(plan));

      if(!profileId || !phone){
        results.push({
          payment_request_id:item.id,
          ok:false,
          message:"Missing profile_id or phone"
        });
        continue;
      }

      const sixHoursAgo =
        new Date(Date.now() - 6 * 60 * 60 * 1000)
          .toISOString();

      const { data:existingRetry } = await sb
        .from("failed_payment_recovery_logs")
        .select("*")
        .eq("payment_request_id",String(item.id))
        .gte("created_at",sixHoursAgo)
        .limit(1)
        .maybeSingle();

      if(existingRetry){
        results.push({
          payment_request_id:item.id,
          ok:false,
          message:"Skipped, already retried within last 6 hours"
        });
        continue;
      }

      const res = await fetch(
        `${SITE_URL}/.netlify/functions/mpesa-stk-push`,
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            profile_id:profileId,
            phone,
            plan,
            amount,
            reason:"failed_payment_recovery"
          })
        }
      );

      const json = await res.json().catch(()=>({}));

      await sb
        .from("failed_payment_recovery_logs")
        .insert({
          payment_request_id:String(item.id),
          profile_id:String(profileId),
          profile_name:item.profile_name || null,
          phone,
          plan,
          amount,
          old_status:item.status,
          recovery_status:res.ok ? "retry_stk_sent" : "retry_failed",
          response:json,
          created_at:new Date().toISOString()
        });

      await sb
        .from("admin_audit_logs")
        .insert({
          action:res.ok
            ? "failed_payment_retry_sent"
            : "failed_payment_retry_failed",
          admin_name:"Failed Payment Recovery",
          profile_id:String(profileId),
          profile_name:item.profile_name || null,
          details:res.ok
            ? `Retry STK sent for KES ${amount}`
            : `Retry failed: ${JSON.stringify(json)}`,
          created_at:new Date().toISOString()
        })
        .then(()=>null)
        .catch(()=>null);

      results.push({
        payment_request_id:item.id,
        profile_id:profileId,
        phone,
        amount,
        ok:res.ok,
        response:json
      });
    }

    return {
      statusCode:200,
      body:JSON.stringify({
        ok:true,
        checked:failed?.length || 0,
        attempted:results.length,
        results
      })
    };

  }catch(error){
    return {
      statusCode:500,
      body:JSON.stringify({
        ok:false,
        message:error.message
      })
    };
  }
};
