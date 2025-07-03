// server.js - Web server to connect UI to your scheduling bot
const express = require("express");
const cors = require("cors");
const path = require("path");
const SchedulingBot = require("./main");

const app = express();
const port = 3000;

// Initialize your scheduling bot
const schedulingBot = new SchedulingBot();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve static files

// API Routes
app.post("/api/schedule", async (req, res) => {
  // this needs to be split into two routes
  // one for the scheduling bot and one for the calendar
  // the scheduling bot will be used to give you the suggested dates and times
  // the calendar will be used to add the activity to the calendar if the dates and times are confirmed
  // what does it look like to start to understand this application now that ai has built the scheduling bot?

  try {
    const { request } = req.body;
    console.log("Received scheduling request:", request);

    const result = await schedulingBot.scheduleHobbyWithCalendar(request);
    console.log("result");
    console.log(result);
    console.log("result");
    if (result) {
      res.json({
        success: true,
        activityInfo: result.activityInfo,
        scheduledTimes: result.scheduledTimes.map((time) => ({
          day: time.toLocaleDateString("en-US", { weekday: "long" }),
          time: time.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          date: time.toISOString(),
          fullDate: time.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }),
        })),
        explanation: result.explanation,
      });
    } else {
      res.json({
        success: false,
        message:
          "Could not find suitable times. Try being more flexible with your preferences.",
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
});

app.post("/api/add-to-calendar", async (req, res) => {
  try {
    const { schedule } = req.body;
    console.log("Adding to calendar:", schedule);

    // Convert the schedule times back to Date objects
    const scheduledTimes = schedule.times.map((slot) => new Date(slot.date));

    // Extract activity name and duration
    const activityName = schedulingBot.extractActivityName(schedule.activity);
    const duration = 45; // You might want to extract this from the schedule

    // Create calendar events
    const events = await schedulingBot.calendar.createRecurringEvents(
      schedulingBot.capitalizeWords(activityName),
      scheduledTimes,
      duration,
      `Scheduled by AI Assistant\n\n${schedule.activity}`
    );

    res.json({
      success: true,
      eventsCreated: events.length,
      message: `Successfully added ${events.length} events to your calendar!`,
    });
  } catch (error) {
    console.error("Error adding to calendar:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add events to calendar.",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    botInitialized: !!schedulingBot,
  });
});

// Serve the UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
async function startServer() {
  const success = await schedulingBot.initialize();
  if (!success) {
    console.error("Failed to initialize scheduling bot");
    process.exit(1);
  }
  console.log("✅ Scheduling bot initialized");
  app.listen(port, () => {
    console.log(`🚀 Scheduling Bot UI running at http://localhost:${port}`);
    console.log("💡 Open your browser and visit the URL above!");
  });
}

startServer().catch(console.error);
