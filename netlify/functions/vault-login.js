exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, message: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";

    if (!process.env.VAULT_PASSWORD) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, message: "Vault password not set" }),
      };
    }

    if (password !== process.env.VAULT_PASSWORD) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, message: "Wrong password" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        token: "vault-unlocked",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, message: error.message }),
    };
  }
};
