// main.js - Complete JavaScript scheduling bot
const OpenAIClient = require("./openai-client");
const GoogleCalendarIntegration = require("./calendar");
const Scheduler = require("./scheduler");
const readline = require("readline-sync");

class SchedulingBot {
  constructor() {
    this.openai = new OpenAIClient();
    this.calendar = new GoogleCalendarIntegration();
    this.scheduler = new Scheduler(this.calendar);
  }

  async initialize() {
    console.log("🤖 Initializing Scheduling Bot...");

    const success = await this.calendar.authenticate();
    if (!success) {
      console.log("❌ Could not connect to Google Calendar. Exiting...");
      return false;
    }

    return true;
  }

  async scheduleHobbyWithCalendar(userRequest) {
    console.log("🤖 Processing your scheduling request...\n");

    try {
      // Step 1: Understand request
      console.log("Step 1: Understanding your request...");
      const activityInfo = await this.openai.understandRequest(userRequest);
      const activityName = this.extractActivityName(activityInfo);
      console.log(`✅ Understood: ${activityName}`);

      // Step 2: Find REAL conflict-free times
      console.log(
        "\nStep 2: Finding conflict-free times in your actual calendar..."
      );
      const goodTimes = await this.scheduler.findGoodTimesWithRealCalendar(
        activityInfo
      );

      if (!goodTimes.length) {
        console.log("❌ No conflict-free times found! Try:");
        console.log("   - Being more flexible with preferred times");
        console.log("   - Reducing frequency");
        console.log("   - Extending the deadline");
        return null;
      }

      console.log(`✅ Found ${goodTimes.length} conflict-free time slots`);

      // Step 3: Create explanation
      console.log("\nStep 3: Creating your schedule explanation...");
      const urgency = this.extractUrgency(activityInfo);
      let response = await this.openai.explainSchedule(
        goodTimes,
        activityInfo,
        urgency
      );

      // Add daily breakdown for multiple sessions
      const dailyBreakdown = this.scheduler.formatScheduleWithDailyBreakdown(
        goodTimes,
        activityInfo,
        urgency
      );
      response += dailyBreakdown;

      // Step 4: Show schedule and ask about calendar
      console.log("✅ Schedule created!\n");
      console.log("=".repeat(50));
      console.log("🎯 YOUR CONFLICT-FREE SCHEDULE");
      console.log("=".repeat(50));
      console.log(response);
      console.log("=".repeat(50));

      // Show specific times found
      console.log("\n📅 Conflict-free time slots found:");
      goodTimes.forEach((timeSlot, i) => {
        console.log(
          `   ${i + 1}. ${timeSlot.toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}`
        );
      });
      //this should be a response back to the client
      // so this functionn needs to be split into two functions
      const createEvents = readline
        .question(
          "\n📅 Would you like me to add these to your Google Calendar? (y/n): "
        )
        .toLowerCase();

      let events = null;
      if (createEvents === "y") {
        // Extract duration
        let duration = 45; // default
        if (
          activityInfo.includes("60 minutes") ||
          activityInfo.includes("1 hour")
        ) {
          duration = 60;
        } else if (activityInfo.includes("30 minutes")) {
          duration = 30;
        }

        console.log(
          `\n📅 Adding ${goodTimes.length} events to your calendar...`
        );

        events = await this.calendar.createRecurringEvents(
          this.capitalizeWords(activityName),
          goodTimes,
          duration,
          `Scheduled by AI Assistant\n\n${activityInfo}`
        );

        if (events && events.length > 0) {
          console.log("🎉 Success! All events added without conflicts.");
          console.log(
            "📱 You'll get reminders 1 day before and 15 minutes before each session."
          );
        } else {
          console.log("❌ Some events couldn't be created.");
        }
      }

      return {
        activityInfo: activityInfo,
        scheduledTimes: goodTimes,
        explanation: response,
        calendarEvents: events,
      };
    } catch (error) {
      console.error(`❌ Error processing request: ${error.message}`);
      return null;
    }
  }

  async interactiveMode() {
    console.log(
      "🤖 Welcome to your Personal Scheduling Assistant with Google Calendar!"
    );
    console.log(
      "I'll help you schedule hobbies and tasks and add them to your real calendar."
    );
    console.log("Try things like:");
    console.log('- "I want to practice guitar 3 times a week"');
    console.log(
      '- "I need to study for my exam, deadline Friday, this is urgent"'
    );
    console.log(
      '- "Help me schedule cooking practice twice a week in the evenings"'
    );
    console.log('\nType "quit" to exit.\n');

    while (true) {
      const userInput = readline.question(
        "📝 What would you like to schedule? "
      );

      if (["quit", "exit", "stop"].includes(userInput.toLowerCase())) {
        console.log("👋 Thanks for using the scheduling assistant!");
        break;
      }

      if (!userInput.trim()) {
        console.log("Please enter a scheduling request.");
        continue;
      }

      try {
        const result = await this.scheduleHobbyWithCalendar(userInput);

        if (result) {
          console.log("\n" + "=".repeat(50));
          const satisfied = readline
            .question("😊 Happy with this schedule? (y/n): ")
            .toLowerCase();

          if (satisfied === "n") {
            console.log("Let's try again! Be more specific about:");
            console.log("- Preferred times (morning/afternoon/evening)");
            console.log("- How long each session should be");
            console.log("- Any deadlines or urgency");
            console.log();
            continue;
          } else {
            console.log("🎉 Great! Your schedule is ready to go!");

            const another = readline
              .question("\nWould you like to schedule something else? (y/n): ")
              .toLowerCase();
            if (another !== "y") {
              console.log("👋 Have a productive day!");
              break;
            }
          }
        }
      } catch (error) {
        console.log(`❌ Oops! Something went wrong: ${error.message}`);
        console.log("Please try again with a different request.");
      }

      console.log("\n" + "-".repeat(50) + "\n");
    }
  }

  async quickTest() {
    console.log("🧪 Running Quick Test...\n");

    const testRequests = [
      "I want to practice guitar 3 times a week after dinner",
      "I need to study for my exam 5 times this week, deadline is Friday, this is urgent!",
      "Help me schedule yoga sessions twice a week in the mornings",
    ];

    for (let i = 0; i < testRequests.length; i++) {
      const request = testRequests[i];
      console.log("\n" + "=".repeat(60));
      console.log(`TEST ${i + 1}: ${request}`);
      console.log("=".repeat(60));

      try {
        await this.scheduleHobbyWithCalendar(request);
      } catch (error) {
        console.log(`❌ Test ${i + 1} failed: ${error.message}`);
      }

      if (i < testRequests.length - 1) {
        readline.question("\nPress Enter for next test...");
      }
    }
  }

  async testCalendarIntegration() {
    console.log("🧪 Testing Calendar Integration...\n");
    await this.calendar.testConflictDetection();
  }

  extractActivityName(activityInfo) {
    const lines = activityInfo.split("\n");
    for (const line of lines) {
      if (line.startsWith("Activity:")) {
        return line.replace("Activity:", "").trim();
      }
    }
    return "your activity";
  }

  extractUrgency(activityInfo) {
    const text = activityInfo.toLowerCase();
    if (text.includes("urgency: high")) return "high";
    if (text.includes("urgency: medium")) return "medium";
    return "low";
  }

  capitalizeWords(str) {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
}

// Main execution
async function main() {
  const bot = new SchedulingBot();

  const initialized = await bot.initialize();
  if (!initialized) {
    process.exit(1);
  }

  console.log("\nChoose mode:");
  console.log("1. Interactive mode (recommended)");
  console.log("2. Quick test");
  console.log("3. Test calendar integration");

  const choice = readline.question("Enter 1, 2, or 3: ").trim();

  switch (choice) {
    case "2":
      await bot.quickTest();
      break;
    case "3":
      await bot.testCalendarIntegration();
      break;
    default:
      await bot.interactiveMode();
      break;
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SchedulingBot;
