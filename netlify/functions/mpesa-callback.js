function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

exports.handler = async function (event) {
  try {
    console.log("M-Pesa Callback:", event.body || "{}");

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback received successfully"
    });

  } catch (error) {
    return json(500, {
      ResultCode: 1,
      ResultDesc: error.message || "Callback error"
    });
  }
};
