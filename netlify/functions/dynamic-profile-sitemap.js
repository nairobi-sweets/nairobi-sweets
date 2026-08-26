const generate = require("./generate-sitemaps.js");

exports.handler = async function (event, context) {
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    type: "profiles"
  };

  return generate.handler(event, context);
};
