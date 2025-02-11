# AI-Powered Call Assistant with Twilio and OpenAI

## Overview

This project is a Node.js-based AI-powered call assistant that utilizes Twilio for VoIP calls and OpenAI's real-time API for AI-driven responses. The system allows users to initiate phone calls via a web interface, connects the calls through Twilio, and processes real-time speech using OpenAI's GPT-4o model to generate interactive conversations.

## Features 🚀

- **Initiate phone calls**: Users can input a phone number on a web interface to start a call.
- **AI-driven conversation**: The AI assistant listens and responds to the caller dynamically.
- **WebSocket-based real-time audio streaming**: Enables smooth communication between Twilio's media stream and OpenAI's API.
- **Twilio call recording**: Calls can be recorded for reference.
- **Customizable assistant personality**: AI is set to be a positive, bubbly assistant fluent in Hebrew with a penchant for dad jokes and subtle rickrolling.

## Prerequisites 📋

- Node.js installed on your system.
- A Twilio account with API credentials.
- An OpenAI API key with access to real-time speech processing.
- (Optional) ngrok for local server exposure.

## Installation 🛠️

1. Clone this repository:
   ```sh
   git clone https://github.com/ariWeinberg/ai-voice-bot.git
   cd ai-voice-bot
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   PORT=5050
   SERVER_URL_1=https://your-server-url.com
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_CALLER_ID=your_twilio_caller_id
   ```

### (Optional) Setting up ngrok

If you are running the server locally and need to expose it to the internet (for Twilio callback URLs), you can use ngrok:

```sh
ngrok http 5050
```

Copy the HTTPS URL provided by ngrok and update your `.env` file:

```env
SERVER_URL_1=https://your-ngrok-url.ngrok.io
```

4. Start the server:
   ```sh
   node server.js
   ```

## Configuring Twilio 📞

1. Sign up for a Twilio account at [Twilio Console](https://www.twilio.com/console).
2. Get your **Account SID**, **Auth Token**, and **Twilio Caller ID**.
3. Go to **Twilio Console > Voice > TwiML Apps** and create a new TwiML App.
4. Set the **Voice Request URL** to your server's `/call-twiml` endpoint (e.g., `https://your-ngrok-url.ngrok.io/call-twiml`).
5. Save and associate this TwiML App with your Twilio phone number.

## Usage 🎯

There are two ways to use the AI-powered call assistant:

1. **Via Web Interface:**
   - Open a web browser and navigate to `http://localhost:5050`.
   - Enter the recipient's phone number and click the "Call" button.
   - The AI assistant will answer and interact with the user in real-time.

2. **By Calling the Twilio-Assigned Number:**
   - Dial the Twilio phone number configured in your Twilio account.
   - The AI assistant will pick up and engage in conversation automatically.

## Technical Overview 🏗️

- **Backend**: Built with `Node.js` and `Express.js`.
- **WebSocket Integration**: Twilio's media stream connects to OpenAI's real-time speech API.
- **OpenAI API**: Processes speech input and generates AI-driven responses.
- **Twilio API**: Handles call initiation and media streaming.

## Customization 🎨

- Modify the AI assistant's behavior in `SYSTEM_MESSAGE`.
- Change the `VOICE` parameter to adjust the AI’s voice.

## License 📜

This project is licensed under the MIT License. Feel free to modify and distribute as needed.

## Contributions 🤝

Contributions are welcome! Feel free to submit a pull request or open an issue for feature suggestions.

## Contact 📩

For any questions or support, reach out to [Your Contact Info].

