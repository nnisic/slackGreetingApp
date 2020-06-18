var Base64 = require('js-base64').Base64;
const crypto = require('crypto');

exports.handler = async (event) => {

  /*
  * Error messages.
  */
  const unauthorizedRequestMessage = "Unauthorized request. Either the request signature doesn't match the local computed signature, or the request is too old to fulfill.";
  const badRequestMessage = "Bad request. Please make sure to include a request header & body, along with a timestamp and signature in the header.";

  try {

    /*
    * Verify that the request includes headers, body, and necessary authorization info in he headers. Throw Bad Request error if not.
    */
    if(!(event.headers && event.body && event.headers['x-slack-request-timestamp'] && event.headers['x-slack-signature'])) {
      throw new Error('400');
    }

    /*
    * Get necessary request info to authorize the request.
    */
    const requestTimestamp = event.headers['x-slack-request-timestamp'];
    const requestBody = event.body;
    const slackSignature = event.headers['x-slack-signature'];

    /*
    * Verify that the request is coming from Slack. Throw Unauthorized Request error if request older than 2 minutes or request signature doesn't match computed signature.
    */
    if(!authorizeRequest(requestTimestamp, requestBody, slackSignature)) {
      throw new Error('401');
    };

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
    * Return response with HTTP status code 200 (OK) back to Slack.
    * Also put message payload in response body so that the bot can post the message in response to the slash command.
    * This is the bot's entry point and the beginning of the user flow.
    */
    return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify(messagePayload),
    };

  } catch(error) {


    /*
    * Return error responses according to which types of errors occurred.
    * - 400 for Bad Request, for example if the POST request payload doesn't look like the characteristic Slack interaction payload.
    * - 401 for Unauthorized Request, for example if the request is older than 2 minutes (which is a very generous amount of time)
    *   or if the payload's signature doesn't match the locally computed signature.
    */
    if(error == 'Error: 401') {

      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify({
          message: unauthorizedRequestMessage
        })
      };

    } else if(error == 'Error: 400') {

      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify({
          message: badRequestMessage
        })
      };

    }
  }
};


function authorizeRequest(timestamp, requestBody, slackSignature) {

  /*
  * Gather and format info for Slack request authorization.
  */
  const signingSecret = process.env.signing_secret;
  const decodedBody = Base64.decode(requestBody);
  const baseString = 'v0:' + timestamp + ':' + decodedBody;

  /*
  * Slack's timestamp gives seconds, not milliseconds, so must compare with current time in seconds.
  */
  const currentTime = Date.now()/1000;

  /*
  * Use native crypto library to generate hash.
  */
  const hmac = crypto.createHmac('sha256', signingSecret);
  const undigestedSignature = hmac.update(baseString);
  const mySignature = 'v0=' + hmac.digest('hex');

  /*
  * Return boolean for request authorization in main function. If request is older than 2 minutes or signatures don't match, consider it fake.
  */
  return (mySignature.localeCompare(slackSignature) === 0 && currentTime - timestamp < 60*2);

}
