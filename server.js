require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

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
    "You are a helpful and bubbly AI assistant who loves to chat. " +
    "You have a penchant for dad jokes and rickrolling – subtly. " +
    "Always stay positive, and your main language is Hebrew.";

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);


const functionDescription = `
Call this function when a user asks for a color palette.
`;

const GsessionUpdate = {
    type: "session.update",
    session: {
      tools: [
        {
          type: "function",
          name: "display_color_palette",
          description: functionDescription,
          parameters: {
            type: "object",
            strict: true,
            properties: {
              theme: {
                type: "string",
                description: "Description of the theme for the color scheme.",
              },
              colors: {
                type: "array",
                description: "Array of five hex color codes based on the theme.",
                items: {
                  type: "string",
                  description: "Hex color code",
                },
              },
            },
            required: ["theme", "colors"],
          },
        },
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
    response.say("Please wait while we connect your call.");
    response.pause({ length: 1 });
    response.say("O.K. you can start talking!");
    response.connect().stream({ url: `wss://${new URL(SERVER_URL).host}/media-stream` });
    res.type('text/xml');
    res.send(response.toString());
});

wss.on('connection', async (ws) => {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'realtime=v1' }
    });

    let streamSid = null;
    
    openaiWs.on('open', async () => {
        await initializeSession(openaiWs);
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.event === 'media' && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: data.media.payload }));
        } else if (data.event === 'start') {
            streamSid = data.start.streamSid;
        }
    });

    openaiWs.on('message', (message) => {
        const response = JSON.parse(message);

        //console.log(response);
        
        if (response.type === 'response.audio.delta' && response.delta && streamSid) {
            const audioPayload = Buffer.from(response.delta, 'base64').toString('base64');
            ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioPayload } }));
        }
        
        if (response.type === 'response.function_call_arguments.done') {
            try {
                const functionCall = {
                    name: response.name,
                    arguments: JSON.parse(response.arguments)
                };
                console.log('Reconstructed Function Call:', functionCall);

                if (functionCall.name === 'display_color_palette') {
                    ws.send(JSON.stringify({ event: 'display_palette', data: functionCall.arguments }));
                }
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
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
