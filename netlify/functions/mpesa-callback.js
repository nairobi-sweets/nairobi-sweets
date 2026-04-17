exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    console.log("M-Pesa Callback:", JSON.stringify(body, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Callback received" })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
