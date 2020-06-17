var Base64 = require('js-base64').Base64;
const crypto = require('crypto');

exports.handler = async (event) => {

    const requestTimestamp = event.headers['x-slack-request-timestamp'];
    const requestBody = event.body;
    const slackSignature = event.headers['x-slack-signature'];

    console.log('RESULT OF SIGNATURE COMPARISON: ');
    console.log(compareSignatures(requestTimestamp, requestBody, slackSignature));

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


function compareSignatures(timestamp, requestBody, slackSignature) {
  const signingSecret = process.env.signing_secret;
  const decodedBody = Base64.decode(requestBody);
  const baseString = 'v0:' + timestamp + ':' + decodedBody;
  const currentTime = Date.now()/1000;
  const hmac = crypto.createHmac('sha256', signingSecret);
  const undigestedSignature = hmac.update(baseString);
  const mySignature = 'v0=' + hmac.digest('hex');

  return (mySignature.localeCompare(slackSignature) === 0 && currentTime - timestamp < 60*2);

}
