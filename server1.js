require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const VoiceResponse = require('twilio/lib/twiml/VoiceResponse');

const fs = require('fs');
const e = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 5050;
const SERVER_URL = process.env.SERVER_URL_1;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_CALLER_ID = process.env.TWILIO_CALLER_ID;
const VOICE = 'alloy';
const SYSTEM_MESSAGE =
    "Shalom! 😊 You are a friendly and polite virtual assistant who loves helping people. " +
    "Start by introducing yourself in Hebrew in a warm and casual way. " +
    "Briefly explain that you're here to check if they’re planning to attend the event on Thursday. " +
    "Make the conversation feel natural—don't rush, and let the user respond comfortably. " +

    "First, ask for their name. Then, ask if they are planning to come. " +

    "👉 **If they say NO:** " +
    "- Politely thank them for their time. " +
    "- Save the data with default values: isAttending: False, numberOfAttendees: 0, arrivalMethod: 'other', stayingForFullEvent: False. " +
    "- End the conversation politely and call 'hangup' immediately after saving. " +

    "👉 **If they say YES:** " +
    "- Gradually and naturally ask: " +
    "  - Are they coming alone or with others? How many people in total? " +
    "  - How do they plan to arrive – by car, on foot, or public transportation? " +
    "  - Will they stay for the whole event or just part of it? " +

    "Once all the details are gathered, **repeat back the information** and ask if everything is correct. " +
    "If they confirm, save the data using 'save_data_json'. " +

    "Finally, politely thank the user for their time, say goodbye in a friendly way, and call 'hangup' to end the call. " +

    "Always communicate in Hebrew, prefer audio over text, and make sure the conversation stays **warm, friendly, and unrushed**! 😊";



const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);





const Tevent = {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: "start now!",
        }
      ]
    },
  };

  const TCloseEvent = {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: "great! now greet the user. Thank them for the details and then by calling the function 'hangup' with no arguments end the call.",
        }
      ]
    },
  };

const TCRevent = {
    type: "response.create",
    response: {
      modalities: ['audio', 'text']
    },
  };

const Functions = {
    hangup: {
        descriptor: {
            type: "function",
            name: "hangup",
            description: "Politely end the call after confirming and saving the details.",
        },
        function: (openaiWs, callSid) => {
            client.calls(callSid).update({ status: 'completed' });
            console.log("Call ended.");
        }
    },
    save_data_json: {
        descriptor: {
            type: "function",
            name: "save_data_json",
            description: "Save user-provided event attendance data in a structured JSON file.",
            parameters: {
                type: "object",
                strict: true,
                properties: {
                    userName: {
                        type: "string",
                        description: "The user's full name.",
                    },
                    isAttending: {
                        type: "boolean",
                        description: "Whether the user is attending the event.",
                    },
                    numberOfAttendees: {
                        type: "integer",
                        description: "Total number of people attending, including the user.",
                    },
                    arrivalMethod: {
                        type: "string",
                        description: "How they are arriving at the event.",
                        enum: ["car", "on foot", "public transportation", "other"],
                    },
                    stayingForFullEvent: {
                        type: "boolean",
                        description: "Whether they plan to stay for the entire event.",
                    },
                },
                required: ["userName", "isAttending", "numberOfAttendees", "arrivalMethod", "stayingForFullEvent"],
            },
        },
        function: (openaiWs, callSid, userName, isAttending, numberOfAttendees, arrivalMethod, stayingForFullEvent) => {
            const data = {
                userName,
                isAttending,
                numberOfAttendees,
                arrivalMethod,
                stayingForFullEvent,
            };
            console.log("Data saved:", data);
            const filePath = './data/calls/' + callSid + '/summary_data.json';
            fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                } else {
                    console.log('File has been saved.');
                }
            });

            openaiWs.send(JSON.stringify(TCloseEvent));
            openaiWs.send(JSON.stringify(TCRevent));
        }
    }                
}

const GsessionUpdate = 
{
  type: "session.update",
  session: {
      tools: [
        Functions.hangup.descriptor,
        Functions.save_data_json.descriptor
      ],
      tool_choice: "auto",
  },
};




app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Call Initiation</title></head>
        <body>
            <h1>Initiate a Call</h1>
            <form action="/initiate-call" method="post">
                <label for="to_number">Enter Phone Number:</label>
                <input type="text" id="to_number" name="to_number" required>
                <button type="submit">Call</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/initiate-call', async (req, res) => {
    const { to_number } = req.body;
    if (!to_number) {
        return res.status(400).json({ error: "Missing 'to_number' field" });
    }
    try {
        const call = await client.calls.create({
            to: to_number,
            from: TWILIO_CALLER_ID,
            url: `${SERVER_URL}/call-twiml`,
            record: true,
            recordingTrack: "both",
            recordingChannels: "dual"
        });
        res.json({ message: `Call initiated to ${to_number}`, call_sid: call.sid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/call-twiml', (req, res) => {
    const response = new twilio.twiml.VoiceResponse();
    // response.say("Please wait while we connect your call.");
    // response.pause({ length: 0.3 });
    // response.say("O.K. you can start talking!");
    response.connect().stream({ url: `wss://${new URL(SERVER_URL).host}/media-stream` });
    res.type('text/xml');
    res.send(response.toString());
});

wss.on('connection', async (ws) => {

    
    
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'realtime=v1' }
    });

    let callSid = null;
    let streamSid = null;
    
    openaiWs.on('open', async () => {
        await initializeSession(openaiWs);
    });
    
    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        if (callSid !== null) {

            fs.appendFile("./data/calls/" + callSid + "/log.txt", "\nFrom Twilio: " + JSON.stringify(data) + "\n", (err) => {
        });
        }
        if (data.event === 'start') {
            //streamSid = data.streamSid;
            callSid = data.start.callSid;

            fs.mkdir("./data/calls/" + callSid, { recursive: true }, (err) => {
                if (err) {
                    console.error(err);
                }
            }); 

            console.log("call SID is: ", callSid);
            client.calls.get(callSid).recordings.create()
            .then((recording) => {
                console.log('Recording SID:', recording.sid);
            })
        }
        if (data.event === 'media') {

            if (callSid !== null) {

                fs.appendFile("./data/calls/" + callSid + "/twilio_transcript.txt", "\n " + JSON.stringify(data.media.payload) + "\n", (err) => {
            });
            }
        }
        if (data.event === 'media' && openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: data.media.payload }));
        } else if (data.event === 'start') {
            streamSid = data.start.streamSid;
        }
    });

    openaiWs.on('message', (message) => {
        const response = JSON.parse(message);

        console.log(response.type);
        if (callSid !== null) {

            fs.appendFile("./data/calls/" + callSid + "/log.txt", "\nFrom OpenAI: " + JSON.stringify(response) + "\n", (err) => {
        });
        }

        if (response.type === 'error') {
            console.error('Error from OpenAI:', response);
            return;
        }
        
        if (response.type === 'response.audio.delta' && response.delta && streamSid) {
            const audioPayload = Buffer.from(response.delta, 'base64').toString('base64');
            ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioPayload } }));
        }

        if (response.type === 'response.text.done' && response.delta && streamSid) {
            console.log(response);
            if (callSid !== null) {

                fs.appendFile("./data/calls/" + callSid + "/openAI_text.txt", "\n" + JSON.stringify(response.text) + "\n", (err) => {
            });
            }
        }


        if (response.type === 'response.audio_transcript.done') {
            console.log(response.transcript);

            if (callSid !== null) {

                fs.appendFile("./data/calls/" + callSid + "/OpenAi_transcript.txt", "\n" + JSON.stringify(response) + "\n", (err) => {
            });
            }
        }

        if (response.type === 'response.function_call_arguments.done') {
            
            if (callSid === null) {
                console.error('Call SID is null. | got a function call without a call SID.');
                return;
            }

            try {
                Functions[response.name].function(openaiWs, callSid, ...Object.values(JSON.parse(response.arguments)));
            } catch (error) {
                console.error('Error parsing function call:', error);
            }
        }
    });

    ws.on('close', () => {
        openaiWs.close();
    });
});

async function initializeSession(openaiWs) {
    const sessionUpdate = {
        type: 'session.update',
        session: {
            turn_detection: { type: 'server_vad' },
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            voice: VOICE,
            instructions: SYSTEM_MESSAGE,
            modalities: ['text', 'audio'],
            temperature: 0.8
        }
    };
    openaiWs.send(JSON.stringify(sessionUpdate));
    openaiWs.send(JSON.stringify(GsessionUpdate));
    openaiWs.send(JSON.stringify(Tevent));
    openaiWs.send(JSON.stringify(TCRevent));
}




server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
