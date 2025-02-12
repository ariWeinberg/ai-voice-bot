require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const VoiceResponse = require('twilio/lib/twiml/VoiceResponse');


const axios = require('axios');
const path = require('path');

const fs = require('fs');
const e = require('express');
const { time } = require('console');

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
    "You are a polite and professional AI representative responsible for confirming guest attendance at an event. " +
    "You always begin the conversation in **Hebrew**, but if the invitee requests a different language, you must switch accordingly. " +
    "If the invitee asks, you must disclose that you are an AI representative. " +

    "Your task is to **call invitees, confirm their attendance, and collect relevant details** in a natural and polite manner. " +
    "Ensure the conversation flows smoothly without rushing the invitee. " +

    "### **Conversation Flow:** " +
    
    "1️⃣ **Start the conversation in Hebrew with a warm introduction:** " +
    "   - \"שלום, כאן [אנה] מצוות אישורי ההגעה לאירוע של [אבי] ו[תמר], שיתקיים בתאריך [20.6.2025] בשעה [19:00] באולם האירועים [ויולט].\"" +

    "2️⃣ **If the invitee asks to switch languages, politely accommodate their request.** " +

    "3️⃣ **If the invitee asks if you are human, respond honestly:** " +
    "   - \"אני נציג AI שמסייע בתהליך אישורי ההגעה, אני כאן כדי לעזור!\" " +

    "4️⃣ **Ask for their full name carefully and repeat it back for confirmation.** " +
    "   - If the name is unclear, politely ask them to confirm or spell it out. " +
    
    "5️⃣ **Ask if they are attending the event:** " +
    "   - **If 'Yes':** Ask how many guests will be joining them. " +
    "   - **If 'No':** Acknowledge politely, thank them, and finalize the conversation. " +
    "   - **If 'Maybe':** Ask for a preferred follow-up date to check again. " +

    "6️⃣ **Once all details are gathered, repeat back the information for confirmation.** " +
    
    "7️⃣ **After confirmation, save the response in JSON format and end the call politely.** " +

    "### **JSON Response Format:** " +
    "{ " +
    "  \"invitee_name\": \"[Full Name]\"," +
    "  \"attendance\": \"yes/no/maybe\"," +
    "  \"guest_count\": [Number] (only if \"yes\")," +
    "  \"follow_up_date\": \"[YYYY-MM-DD]\" (only if \"maybe\")," +
    "  \"remarks\": \"[Any additional notes]\"" +
    "} " +

    "### **Examples of Natural Conversations:** " +

    "**✅ If the invitee confirms attendance:** " +
    "  - *Agent:* \"נפלא! כמה אנשים יגיעו יחד איתך?\" " +
    "  - *User:* \"אני ועוד שלושה.\" " +
    "  - **JSON Output:** " +
    "{ " +
    "  \"invitee_name\": \"אייל כהן\", " +
    "  \"attendance\": \"yes\", " +
    "  \"guest_count\": 3, " +
    "  \"follow_up_date\": null, " +
    "  \"remarks\": \"מחכים לזה מאוד!\" " +
    "} " +

    "**✅ If the invitee cannot attend:** " +
    "  - *Agent:* \"חבל שלא נוכל לראות אותך שם, תודה רבה וערב טוב!\" " +
    "  - **JSON Output:** " +
    "{ " +
    "  \"invitee_name\": \"רותם לוי\", " +
    "  \"attendance\": \"no\", " +
    "  \"guest_count\": 0, " +
    "  \"follow_up_date\": null, " +
    "  \"remarks\": \"אהיה בחו״ל באותו יום\" " +
    "} " +

    "**✅ If the invitee is unsure:** " +
    "  - *Agent:* \"אין בעיה! מתי יהיה לך נוח שאנסה שוב?\" " +
    "  - *User:* \"תתקשר שוב ב-10 בפברואר.\" " +
    "  - **JSON Output:** " +
    "{ " +
    "  \"invitee_name\": \"נועה ברק\", " +
    "  \"attendance\": \"maybe\", " +
    "  \"guest_count\": null, " +
    "  \"follow_up_date\": \"2025-02-10\", " +
    "  \"remarks\": \"עדיין לא סגורה על הלו\"ז\" " +
    "} " +

    "### **Final Notes:** " +
    "✅ Always start in Hebrew unless requested otherwise. " +
    "✅ Be polite, patient, and professional. " +
    "✅ Ensure all collected data is well-structured in JSON format. " +
    "✅ If the invitee is unsure, set a **clear follow-up date**. " +
    "✅ Make the conversation feel **natural and smooth**, without rushing. ";


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
            parameters: {
                type: "object",
                strict: true,
                properties: {
                    conversation: {
                        type: "string",
                        description: "The conversation transcript.",
                    },
                },
                required: ["conversation"],
            },
        },
        function: (openaiWs, callSid, conversation) => {

            console.log("Hangup initiated.");
            console.log("Conversation transcript:");
            console.log(conversation);

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
                    invitee_name: {
                        type: "string",
                        description: "The invitee's full name.",
                    },
                    attendance: {
                        type: "string",
                        description: "The attendance status of the invitee.",
                        enum: ["yes", "no", "maybe"],
                    },
                    guest_count: {
                        type: "integer",
                        description: "Total number of people attending, including the invitee. Only applicable if 'attendance' is 'yes'.",
                        nullable: true,
                    },
                    follow_up_date: {
                        type: "string",
                        description: "Follow-up date in YYYY-MM-DD format. Only applicable if 'attendance' is 'maybe'.",
                        nullable: true,
                    },
                    remarks: {
                        type: "string",
                        description: "Any additional notes provided by the invitee.",
                        nullable: true,
                    },
                },
                required: ["invitee_name", "attendance"],
            },
        },
        function: (openaiWs, callSid, invitee_name, attendance, guest_count = null, follow_up_date = null, remarks = null) => {
            const data = {
                invitee_name,
                attendance,
                guest_count,
                follow_up_date,
                remarks,
            };
            console.log("Data saved:", data);
    
            const filePath = `./data/calls/${callSid}/summary_data.json`;
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
            recordingChannels: "dual",
            recordingStatusCallback: `${SERVER_URL}/recording`,
            recordingStatusCallbackMethod: 'POST'
        });
        res.json({ message: `Call initiated to ${to_number}`, call_sid: call.sid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/recording', async (req, res) => {
    try {
        const recordingUrl = req.body.RecordingUrl;
        const recordingSid = req.body.RecordingSid;
        const callSid = req.body.CallSid;
        const dirPath = `./data/calls/${callSid}`;

        // Create the directory if it doesn't exist
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, `recording_${recordingSid}.mp3`);
        const writer = fs.createWriteStream(filePath);

        // Download with authentication
        const response = await axios({
            method: 'get',
            url: recordingUrl,
            responseType: 'stream',
            auth: {
                username: TWILIO_ACCOUNT_SID,
                password: TWILIO_AUTH_TOKEN
            }
        });

        response.data.pipe(writer);

        writer.on('finish', () => {
            console.log('Recording downloaded successfully.');
            res.json({ message: 'Recording downloaded successfully.' });
        });

        writer.on('error', (err) => {
            console.error('Error saving recording:', err);
            res.status(500).json({ error: 'Error saving recording' });
        });

    } catch (error) {
        console.error('Error downloading recording:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error downloading recording' });
    }
});

app.post('/call-twiml', (req, res) => {
    const response = new twilio.twiml.VoiceResponse();
    // response.record({ transcribe: true, maxLength: 10, transcribeCallback: `${SERVER_URL}/recording` });
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

        if (response.type === 'conversation.item.input_audio_transcription.completed') {
            console.log(response.transcript);
            fs.appendFile("./data/calls/" + callSid + "/OpenAi_transcript.txt", `${new Date().toLocaleString()} | User: ${response.transcript}\n`, (err) => {
            });
        }

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

                fs.appendFile("./data/calls/" + callSid + "/OpenAi_transcript.txt", `${new Date().toLocaleString()} | Agent: ${response.transcript}\n`, (err) => {
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
            temperature: 0.6,
            turn_detection: {
                "type": "server_vad",
                "threshold": 0.7,
                "prefix_padding_ms": 700,
                "silence_duration_ms": 600
            },
            input_audio_transcription: {
                language: 'he',
                model: 'whisper-1'
            }
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
