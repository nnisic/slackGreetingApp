var Base64 = require('js-base64').Base64;
const fetch = require('node-fetch');


exports.handler = async (event) => {

  //Decode Slack payload from Base64 encoded URI to JSON
  const eventBodyDecoded = Base64.decode(event.body);
  const payloadJson = JSON.parse(decodeURIComponent(Base64.decode(event.body).split("=")[1]));
  const interactionType = payloadJson.type;
  const triggerId = payloadJson.trigger_id;

  if(interactionType === "block_actions") {

    const channelId = payloadJson.channel.id;

    console.log('PAYLOAD: ');
    console.log(payloadJson);

    const viewPayload =
      {
        "trigger_id": triggerId,
        "view": {
        	"type": "modal",
        	"title": {
        		"type": "plain_text",
        		"text": "Greeting bot",
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

    await fetch('https://slack.com/api/views.open', {
      method: "post",
      body: JSON.stringify(viewPayload),
      headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer /* token here */"
      }
    });

    const response = {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      "isBase64Encoded": false,
        statusCode: 200,
        body: JSON.stringify('It worked!'),
    };

    return response;

  } else if(interactionType === "view_submission") {

    const channelId = payloadJson.view.private_metadata;
    const blockId = payloadJson.view.blocks[0].block_id;
    const actionId = payloadJson.view.blocks[0].element.action_id;
    const inputValue = payloadJson.view.state.values[blockId][actionId].value;

    const viewPayload = {
      "channel": channelId,
    	"blocks": [
    		{
    			"type": "section",
    			"text": {
    				"type": "plain_text",
    				"text": "Hello " + inputValue + "!"
    			}
    		}
    	]
    }

    await fetch('https://slack.com/api/chat.postMessage', {
      method: "post",
      body: JSON.stringify(viewPayload),
      headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer /* token here */"
      }
    });

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
