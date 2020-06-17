var Base64 = require('js-base64').Base64;
const fetch = require('node-fetch');


exports.handler = async (event) => {

  /*
  * Decode Slack payload from Base64 encoded URI to JSON
  */
  const payloadJson = JSON.parse(decodeURIComponent(Base64.decode(event.body).split("=")[1]));

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
    await fetch('https://slack.com/api/views.open', {
      method: "post",
      body: JSON.stringify(viewPayload),
      headers: {
      "Content-Type": "application/json",
      "Authorization": slackToken
      }
    });

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
    await fetch('https://slack.com/api/chat.postMessage', {
      method: "post",
      body: JSON.stringify(messagePayload),
      headers: {
      "Content-Type": "application/json",
      "Authorization": slackToken
      }
    });

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


};
