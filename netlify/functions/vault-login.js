exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: false,
          message: "Method not allowed"
        })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const password = String(body.password || "").trim();

    const vaultPassword = process.env.VAULT_PASSWORD;

    if (!vaultPassword) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: false,
          message: "VAULT_PASSWORD environment variable not configured"
        })
      };
    }

    if (password !== vaultPassword) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: false,
          message: "Invalid password"
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        message: "Vault unlocked",
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        message: error.message
      })
    };

  }
};
