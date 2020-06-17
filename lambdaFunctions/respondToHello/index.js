
exports.handler = async (event) => {

    /*
    * Build message payload to send back in response body as a response to Slack's slash command POST request.
    */
    const messagePayload = {
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

    /*
    * Return response with HTTP status code 200 back to Slack.
    * Also put message payload in response body so that the bot can post a message in response to the slash command.
    * This is the bot's entry point and the beginning of the flow of use.
    */
    const response = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify(messagePayload),
    };
    return response;
};
