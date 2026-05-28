exports.handler = async function () {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "admin-upsert-admin-user placeholder active"
    })
  };
};
