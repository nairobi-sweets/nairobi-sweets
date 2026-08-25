const generate = require("./generate-sitemaps.js");

exports.handler = async function (event, context) {
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    type: "locations"
  };

  return generate.handler(event, context);
};
