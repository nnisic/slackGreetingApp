var Base64 = require('js-base64').Base64;
const queryString = require('query-string');


exports.handler = async (event) => {

    //Decode Slack payload from Base64 encoded URI to JSON
    const eventBodyJson = queryString.parse(Base64.decode(event.body));

    const viewPayload = {
      "blocks": [
        {
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "emoji": true,
                "text": "Greeting button"
              },
              "style": "primary",
              "value": "click_me_123"
            }
          ]
        }
      ]
    }

    const response = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify(viewPayload),
    };
    return response;
};
