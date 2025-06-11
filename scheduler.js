// scheduler.js - Smart scheduling logic
class Scheduler {
  constructor(calendarIntegration) {
    this.calendar = calendarIntegration;
  }

  // Update the findGoodTimesWithRealCalendar function in scheduler.js
  async findGoodTimesWithRealCalendar(activityInfo) {
    console.log("Checking your real calendar for conflicts...");

    // Parse activity info
    const frequency = this.extractFrequencyNumber(activityInfo);
    const duration = this.extractDurationMinutes(activityInfo);
    const preferredTime = this.extractPreferredTime(activityInfo);
    const urgency = this.extractUrgency(activityInfo);

    console.log(
      `Looking for ${frequency} sessions of ${duration} minutes each`
    );
    console.log(`Preferring ${preferredTime}, up to 3 sessions per day`);

    // Determine how far ahead to look - extend for high frequency requests
    let daysToCheck = 14; // Default 2 weeks
    if (urgency === "high" || frequency > 5)
      daysToCheck = 10; // More days for urgent/frequent
    else if (urgency === "low") daysToCheck = 21;

    const conflictFreeTimes = [];
    const maxSessionsPerDay = 3;

    // Continue until we find enough sessions OR run out of days
    for (
      let day = 0;
      day < daysToCheck && conflictFreeTimes.length < frequency;
      day++
    ) {
      const currentDay = new Date();
      currentDay.setDate(currentDay.getDate() + day);

      // Get potential slots for this day
      const potentialSlots = this.getExpandedTimeSlots(
        currentDay,
        preferredTime,
        duration,
        urgency
      );

      let sessionsToday = 0;

      // Check each slot for conflicts
      for (const slot of potentialSlots) {
        if (sessionsToday >= maxSessionsPerDay) break;
        if (conflictFreeTimes.length >= frequency) break; // This was the issue!

        console.log(
          `  Checking ${slot.toLocaleString("en-US", {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}...`
        );

        // Check for conflicts with real calendar
        const hasConflict = await this.calendar.checkConflicts(slot, duration);

        if (!hasConflict) {
          conflictFreeTimes.push(slot);
          sessionsToday++;
          console.log(
            `    ✅ Free! (Session ${sessionsToday} for this day, ${conflictFreeTimes.length} total)`
          );
        } else {
          console.log(`    ❌ Conflict found`);
        }
      }

      if (sessionsToday > 0) {
        console.log(
          `  📅 Added ${sessionsToday} sessions for ${currentDay.toLocaleDateString(
            "en-US",
            { weekday: "long", month: "long", day: "numeric" }
          )} (${conflictFreeTimes.length}/${frequency} total)`
        );
      }
    }

    if (conflictFreeTimes.length < frequency) {
      console.log(
        `⚠️  Warning: Only found ${conflictFreeTimes.length} conflict-free slots out of ${frequency} requested`
      );
      console.log(
        "   Consider being more flexible with times or extending the date range"
      );
    }

    return conflictFreeTimes;
  }

  // Update extractFrequencyNumber in scheduler.js to handle "8 times"
  extractFrequencyNumber(activityInfo) {
    const text = activityInfo.toLowerCase();

    // Look for specific numbers first
    const numberMatch = text.match(/(\d+)\s*times/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }

    // Then check words
    if (text.includes("daily") || text.includes("every day")) return 7;
    if (text.includes("eight times")) return 8;
    if (text.includes("seven times")) return 7;
    if (text.includes("six times")) return 6;
    if (text.includes("five times")) return 5;
    if (text.includes("four times")) return 4;
    if (text.includes("three times")) return 3;
    if (text.includes("twice") || text.includes("two times")) return 2;
    if (text.includes("once") || text.includes("one time")) return 1;

    return 3; // Default
  }

  extractDurationMinutes(activityInfo) {
    // Look for numbers followed by "minutes" or "min"
    const minutesMatch = activityInfo.match(/(\d+)[-\s]*(?:minutes?|min)/i);
    if (minutesMatch) return parseInt(minutesMatch[1]);

    // Look for hour mentions
    if (activityInfo.toLowerCase().includes("hour")) return 60;

    // Default based on activity
    const text = activityInfo.toLowerCase();
    if (text.includes("guitar") || text.includes("piano")) return 45;
    if (text.includes("exercise") || text.includes("workout")) return 60;
    return 45; // Default
  }

  extractPreferredTime(activityInfo) {
    const text = activityInfo.toLowerCase();
    if (text.includes("morning")) return "morning";
    if (
      text.includes("evening") ||
      text.includes("after dinner") ||
      text.includes("night")
    )
      return "evening";
    if (text.includes("afternoon")) return "afternoon";
    return "flexible";
  }

  extractUrgency(activityInfo) {
    const text = activityInfo.toLowerCase();

    // High urgency keywords
    const highUrgency = [
      "urgent",
      "asap",
      "immediately",
      "emergency",
      "critical",
      "tomorrow",
    ];
    if (highUrgency.some((word) => text.includes(word))) return "high";

    // Check for soon deadlines
    if (
      ["this week", "by friday", "by tomorrow"].some((phrase) =>
        text.includes(phrase)
      )
    )
      return "high";

    // Medium urgency keywords
    const mediumUrgency = ["soon", "quickly", "next week", "important"];
    if (mediumUrgency.some((word) => text.includes(word))) return "medium";

    // Look for "urgency:" in the AI response
    if (text.includes("urgency: high")) return "high";
    if (text.includes("urgency: medium")) return "medium";

    return "low";
  }

  // Update getExpandedTimeSlots in scheduler.js
  // Update getExpandedTimeSlots in scheduler.js
  getExpandedTimeSlots(day, preferredTime, durationMinutes, urgency = "low") {
    const slots = [];
    const now = new Date();

    // Skip weekends for low urgency tasks
    if (urgency === "low" && (day.getDay() === 0 || day.getDay() === 6)) {
      return slots;
    }

    // Helper function to create time slot with past-time checking
    const createSlot = (hour) => {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      // Skip if this time has already passed
      if (slot <= now) {
        return null;
      }

      return slot;
    };

    // RESPECT the preferred time - don't add other times unless flexible or urgent
    if (preferredTime === "morning") {
      // ONLY morning slots: 7am, 8am, 9am, 10am
      [7, 8, 9, 10].forEach((hour) => {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      });
    } else if (preferredTime === "afternoon") {
      // ONLY afternoon slots: 1pm, 2pm, 3pm, 4pm, 5pm
      [13, 14, 15, 16, 17].forEach((hour) => {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      });
    } else if (preferredTime === "evening") {
      // ONLY evening slots: 6pm, 7pm, 8pm, 9pm
      const endHour = urgency === "high" ? 21 : 20;
      for (let hour = 18; hour <= endHour; hour++) {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      }
    } else if (preferredTime === "flexible") {
      // All reasonable slots when flexible
      [7, 8, 9, 10].forEach((hour) => {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      }); // Morning

      [13, 14, 15, 16, 17].forEach((hour) => {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      }); // Afternoon

      const endHour = urgency === "high" ? 21 : 20;
      for (let hour = 18; hour <= endHour; hour++) {
        const slot = createSlot(hour);
        if (slot) slots.push(slot);
      } // Evening
    }

    // For HIGH urgency, expand time options regardless of preference
    if (urgency === "high" && preferredTime !== "flexible") {
      console.log(
        `    ⚡ High urgency: expanding beyond ${preferredTime} preference`
      );

      // Add other time slots for urgent tasks
      if (preferredTime !== "morning") {
        [7, 8, 9].forEach((hour) => {
          const slot = createSlot(hour);
          if (slot) slots.push(slot);
        });
      }
      if (preferredTime !== "afternoon") {
        [13, 14, 15, 16].forEach((hour) => {
          const slot = createSlot(hour);
          if (slot) slots.push(slot);
        });
      }
      if (preferredTime !== "evening") {
        [18, 19, 20, 21].forEach((hour) => {
          const slot = createSlot(hour);
          if (slot) slots.push(slot);
        });
      }

      // Add lunch and late slots for really urgent tasks
      const lunchSlot = createSlot(12); // Noon
      const lateSlot = createSlot(22); // 10pm
      if (lunchSlot) slots.push(lunchSlot);
      if (lateSlot) slots.push(lateSlot);
    }

    // Sort by time and remove duplicates
    const uniqueSlots = [...new Set(slots.map((s) => s.getTime()))]
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());

    return uniqueSlots;
  }

  formatScheduleWithDailyBreakdown(
    scheduledTimes,
    activityInfo,
    urgency = "low"
  ) {
    // Group sessions by day
    const sessionsByDay = new Map();

    scheduledTimes.forEach((sessionTime) => {
      const dayKey = sessionTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      if (!sessionsByDay.has(dayKey)) {
        sessionsByDay.set(dayKey, []);
      }
      sessionsByDay.get(dayKey).push(sessionTime);
    });

    // Check if there are multiple sessions on any day
    const hasMultipleDaily = Array.from(sessionsByDay.values()).some(
      (sessions) => sessions.length > 1
    );

    if (hasMultipleDaily) {
      let breakdown = "\n\n📅 **Daily Breakdown:**";

      sessionsByDay.forEach((sessions, day) => {
        if (sessions.length > 1) {
          const times = sessions
            .sort((a, b) => a - b)
            .map((s) =>
              s.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            );
          breakdown += `\n• ${day}: ${sessions.length} sessions at ${times.join(
            ", "
          )}`;
        } else {
          const time = sessions[0].toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          breakdown += `\n• ${day}: ${time}`;
        }
      });

      if (urgency === "high") {
        breakdown += "\n\n⚡ **Intensive Schedule Tips:**";
        breakdown += "\n• Take 15-minute breaks between same-day sessions";
        breakdown += "\n• Stay hydrated during intensive days";
        breakdown += "\n• Review/practice different aspects in each session";
      }

      return breakdown;
    }

    return "";
  }
}

module.exports = Scheduler;
