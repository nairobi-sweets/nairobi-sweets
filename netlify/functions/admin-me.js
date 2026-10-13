const {json,getAdminFromRequest} = require("./_adminAuth");
exports.handler = async event => {
  try {
    if (event.httpMethod !== "GET") return json(405,{ok:false,message:"Method not allowed"});
    const auth = await getAdminFromRequest(event);
    if (!auth.ok) return auth.response;
    return json(200,{ok:true,admin:auth.admin});
  } catch (_) { return json(500,{ok:false,message:"Could not verify admin session."}); }
};
