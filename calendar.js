// calendar.js - Google Calendar integration
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

class GoogleCalendarIntegration {
  constructor() {
    this.calendar = null;
    this.SCOPES = ["https://www.googleapis.com/auth/calendar"];
    this.TOKEN_PATH = "token.json";
    this.CREDENTIALS_PATH = "credentials.json";
  }

  async authenticate() {
    try {
      // Load client secrets
      const credentials = JSON.parse(fs.readFileSync(this.CREDENTIALS_PATH));
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Check if we have previously stored a token
      if (fs.existsSync(this.TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH));
        oAuth2Client.setCredentials(token);
      } else {
        // Get new token
        await this.getNewToken(oAuth2Client);
      }

      this.calendar = google.calendar({ version: "v3", auth: oAuth2Client });
      console.log("✅ Google Calendar connected!");
      return true;
    } catch (error) {
      console.error("❌ Authentication failed:", error.message);
      return false;
    }
  }

  async getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: this.SCOPES,
    });

    console.log("Authorize this app by visiting this url:", authUrl);

    const readline = require("readline-sync");
    const code = readline.question("Enter the code from that page here: ");

    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      // Store the token
      fs.writeFileSync(this.TOKEN_PATH, JSON.stringify(tokens));
      console.log("Token stored to", this.TOKEN_PATH);
    } catch (error) {
      console.error("Error retrieving access token", error);
      throw error;
    }
  }

  async checkConflicts(startTime, durationMinutes) {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    console.log(
      `    🔍 Checking conflicts for ${startTime.toLocaleString()} - ${endTime.toLocaleTimeString()}`
    );

    try {
      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      if (events.length > 0) {
        console.log(`    ❌ Found ${events.length} conflicting events:`);
        events.forEach((event) => {
          const eventStart = event.start.dateTime || event.start.date;
          const eventTitle = event.summary || "No title";
          console.log(`       • ${eventTitle} at ${eventStart}`);
        });
        return true;
      } else {
        console.log(`    ✅ No conflicts found`);
        return false;
      }
    } catch (error) {
      console.error(`    ⚠️  Error checking conflicts: ${error.message}`);
      return false; // Assume no conflict if we can't check
    }
  }

  async createEvent(
    title,
    startTime,
    durationMinutes,
    description = "",
    location = ""
  ) {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const event = {
      summary: title,
      location: location,
      description: description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 15 }, // 15 min before
        ],
      },
    };

    try {
      const response = await this.calendar.events.insert({
        calendarId: "primary",
        resource: event,
      });

      console.log(`✅ Event created: ${response.data.htmlLink}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error creating event: ${error.message}`);
      return null;
    }
  }

  async createRecurringEvents(
    title,
    scheduledTimes,
    durationMinutes,
    description = ""
  ) {
    const createdEvents = [];

    console.log(`📅 Creating ${scheduledTimes.length} calendar events...`);

    for (let i = 0; i < scheduledTimes.length; i++) {
      const startTime = scheduledTimes[i];
      const eventTitle = `${title} (Session ${i + 1})`;
      const eventDescription = `${description}\n\nScheduled by AI Assistant`;

      const event = await this.createEvent(
        eventTitle,
        startTime,
        durationMinutes,
        eventDescription
      );

      if (event) {
        createdEvents.push(event);
        console.log(`  📝 ${startTime.toLocaleString()}`);
      }
    }

    console.log(`🎉 Created ${createdEvents.length} events successfully!`);
    return createdEvents;
  }

  async listTodaysEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: today.toISOString(),
        timeMax: tomorrow.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      console.log("\n📅 Your events today:");
      if (events.length > 0) {
        events.forEach((event) => {
          const start = event.start.dateTime || event.start.date;
          const title = event.summary || "No title";
          console.log(`• ${title} - ${new Date(start).toLocaleTimeString()}`);
        });
      } else {
        console.log("No events found for today");
      }

      return events;
    } catch (error) {
      console.error("Error listing events:", error.message);
      return [];
    }
  }

  async testConflictDetection() {
    console.log("🧪 Testing conflict detection...");

    // Test with a time 1 hour from now
    const testTime = new Date(Date.now() + 60 * 60 * 1000);

    console.log(`Testing conflict detection at: ${testTime.toLocaleString()}`);
    const hasConflict = await this.checkConflicts(testTime, 60);
    console.log(`Conflict detected: ${hasConflict}`);

    // List today's events
    await this.listTodaysEvents();
  }
}

module.exports = GoogleCalendarIntegration;
