var Base64 = require('js-base64').Base64;
const fetch = require('node-fetch');
const crypto = require('crypto');


exports.handler = async (event) => {

  /*
  * Error messages.
  */
  const unauthorizedRequestMessage = "Unauthorized request. Either the request signature doesn't match the local computed signature, or the request is too old to fulfill.";
  const badRequestMessage = "Bad request. Please make sure to include a request header & body, along with a timestamp and signature in the header.";
  const internalServerErrorMessage = "There was an error with the server's ability to communicate with the Slack API. This is likely due to lack of authorization, or an improperly formatted payload on our behalf."

  try {

    /*
    * Verify that the request includes headers, body, and necessary authorization info in he headers. Throw Bad Request error if not.
    */
    if(!(event.headers && event.body && event.headers['x-slack-request-timestamp'] && event.headers['x-slack-signature'])) {
      throw new Error('400');
    }

    /*
    * Decode Slack payload from Base64 encoded URI to JSON & remove the "payload=" prefix.
    */
    const payloadJson = JSON.parse(decodeURIComponent(Base64.decode(event.body).split("=")[1]));

    /*
    * Get necessary request info to authorize the request.
    */
    const requestTimestamp = event.headers['x-slack-request-timestamp'];
    const requestBody = event.body;
    const slackSignature = event.headers['x-slack-signature'];

    /*
    * Verify that the request is coming from Slack. Throw error if request older than 2 minutes or request signature doesn't match computed signature. Throw Unauthorized Request error if not.
    */
    if(!(authorizeRequest(requestTimestamp, requestBody, slackSignature))) {
      throw new Error('401');
    }

    /*
    * If there's no slack_token environment variable configured, consider it an internal server error and throw an error.
    */
    if(!process.env.slack_token) {
      throw new Error('500');
    }
    /*
    * Get Slack OAuth token from environment variable (configured in AWS Lambda console) so that bot can call Slack API methods.
    */
    const slackToken = process.env.slack_token;

    /*
    * Get the interaction type from the payload to know where to go next with it.
    */
    const interactionType = payloadJson.type;

    if(interactionType === "block_actions") {

      /*
      * Get channel ID from block_actions payload to put in private_metadata field of the view_submission payload (which is sent after user submits modal).
      * I do this because Slack's default view_submission payload doesn't pass any information about the current channel, but it is needed
      * to post a message back into the same channel.
      */
      const channelId = payloadJson.channel.id;

      /*
      * Get triggerID from block_actions payload so that the bot can open a modal in response.
      */
      const triggerId = payloadJson.trigger_id;

      /*
      * Build view payload with trigger ID,
      */
      const viewPayload =
        {
          "trigger_id": triggerId,
          "view": {
          	"type": "modal",
          	"title": {
          		"type": "plain_text",
          		"text": "Greeting Bot",
          		"emoji": true
          	},
          	"submit": {
          		"type": "plain_text",
          		"text": "Send",
          		"emoji": true
          	},
          	"close": {
          		"type": "plain_text",
          		"text": "Cancel",
          		"emoji": true
          	},
          	"blocks": [
          		{
          			"type": "input",
          			"element": {
          				"type": "plain_text_input"
          			},
          			"label": {
          				"type": "plain_text",
          				"text": "What's your name?",
          				"emoji": true
          			}
          		}
          	],
            "private_metadata": channelId
          }
        };

      /*
      * Use node-fetch library to send POST request to views.open API to push modal view onto view stack.
      */
      const fetchResponse = await fetch('https://slack.com/api/views.open', {
        method: "post",
        body: JSON.stringify(viewPayload),
        headers: {
        "Content-Type": "application/json",
        "Authorization": slackToken
        }
      });

      const fetchResponseJson = await fetchResponse.json();

      /*
      * If Slack API call fails, throw internal server error.
      */
      if(!fetchResponseJson.ok) {
        throw new Error('500');
      }

      /*
      * Return response with HTTP status code 200 back to Slack.
      */
      const response = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
      };

      return response;

    } else if(interactionType === "view_submission") {

      /*
      * Get channel ID from the value of the private_metadata field that I put in the view_submission payload (submitting the name modal).
      * I put this in private_metadata because, as far as I can tell, the view_submission payload provides no channel information.
      */
      const channelId = payloadJson.view.private_metadata;

      /*
      * Get block ID and action ID from the view's blocks array so that I can use them to access the user's input value from view's state object.
      * Use the input value to personalize the text in the message payload.
      */
      const blockId = payloadJson.view.blocks[0].block_id;
      const actionId = payloadJson.view.blocks[0].element.action_id;
      const inputValue = payloadJson.view.state.values[blockId][actionId].value;
      const greetingText = "Hello " + inputValue + "!";

      /*
      * Build message payload with channel ID, custom username, and personalized text to send in body of chat.postMessage POST request.
      */
      const messagePayload = {
        "channel": channelId,
        "username": "Greeting Bot",
      	"blocks": [
      		{
      			"type": "section",
      			"text": {
      				"type": "plain_text",
      				"text": greetingText
      			}
      		}
      	],
      }

      /*
      * Use node-fetch library to send POST request to chat.postMessage API to post personalized greeting in same channel.
      */
      const fetchResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: "post",
        body: JSON.stringify(messagePayload),
        headers: {
        "Content-Type": "application/json",
        "Authorization": slackToken
        }
      });

      const fetchResponseJson = await fetchResponse.json();

      /*
      * If Slack API call fails, throw internal server error.
      */
      if(!fetchResponseJson.ok) {
        throw new Error('500');
      }

      /*
      * Return response with HTTP status code 200 back to Slack.
      */
      const response = {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          "isBase64Encoded": false,
      };

      return response;
    }
  } catch(error) {

    /*
    * Return error responses according to which types of errors occurred.
    * - 400 for bad request, for example if the POST request payload doesn't look like the characteristic Slack interaction payload.
    * - 401 for unauthorized request, for example if the request is older than 2 minutes (which is a very generous amount of time)
    *   or if the payload's signature doesn't match the locally computed signature.
    * - 500 if the app was unable to properly communicate with Slack's API, for example if the app's token was revoked or not configured as an environment variable.
    *   Will also be a 500 error if any of the app's calls to Slack's APIs fail.
    */
    if(error == 'Error: 400') {

      const response = {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify({
          message: badRequestMessage
        })
      }

      console.log('RESPONSE: ');
      console.log(response);
      return response;

    } else if(error == 'Error: 401') {

      const response = {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify({
          message: unauthorizedRequestMessage
        })
      }

      console.log('RESPONSE: ');
      console.log(response);
      return response;

    } else if(error == 'Error: 500') {

      const response = {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        "isBase64Encoded": false,
        body: JSON.stringify({
          message: internalServerErrorMessage
        })
      }

      console.log('RESPONSE: ');
      console.log(response);
      return response;

    }


  }

};

function authorizeRequest(timestamp, requestBody, slackSignature) {

  /*
  * Gather and format info for request authorization.
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
  * Return boolean for request authorization in main function. If request is older than 2 minutes or if signatures don't match, consider it fake.
  */
  return (mySignature.localeCompare(slackSignature) === 0 && currentTime - timestamp < 60*2);

}
