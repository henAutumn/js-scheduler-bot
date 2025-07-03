// openai-client.js - Handle OpenAI API calls
require("dotenv").config();

class OpenAIClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = "https://api.openai.com/v1";
  }

  async understandRequest(userMessage) {
    console.log(`Processing request: ${userMessage}`);

    const prompt = `
        Extract scheduling info from this request:
        "${userMessage}"
        
        Return just:
        Activity: [what they want to do]
        How often: [how many times per week]  
        How long: [duration in minutes - if not specified, suggest typical duration for this activity]
        When: [preferred time of day]
        Deadline: [any deadline mentioned, or "none" if no deadline]
        Urgency: [high/medium/low based on deadline or urgency words]
        
        Look for deadline phrases like:
        - "by Friday"
        - "before my exam next week"  
        - "need to finish by..."
        - "deadline is..."
        - "due on..."
        
        Urgency levels:
        - High: deadline within 1 week, words like "urgent", "ASAP", "immediately"
        - Medium: deadline within 2-4 weeks, words like "soon", "quickly"
        - Low: no deadline or distant deadline, words like "eventually", "when I can"
        
        If duration isn't mentioned, use these defaults:
        - Musical instruments: 30-45 minutes
        - Exercise/yoga: 45-60 minutes  
        - Reading: 30-45 minutes
        - Cooking: 60-90 minutes
        - Art/painting: 60-90 minutes
        `;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (response.status !== 200) {
        console.error(`Error: ${response.statusText}`);
        return null;
      }
      const data = await response.json();

      const result = data.choices[0].message.content;
      console.log(`Got response: ${result}`);
      return result;
    } catch (error) {
      console.error(`Error: ${error}`);
      return null;
    }
  }

  async explainSchedule(scheduledTimes, activityInfo, urgency = "low") {
    console.log(`Explaining schedule for ${scheduledTimes.length} sessions...`);

    const timesText = this.formatTimesForExplanation(scheduledTimes);

    const activityName = this.extractActivityName(activityInfo);
    const urgencyContext = this.getUrgencyContext(urgency, activityInfo);

    const prompt = `
        Create a friendly, encouraging explanation for this schedule:
        
        Activity: ${activityName}
        Scheduled times: ${timesText}
        Activity details: ${activityInfo}
        ${urgencyContext}
        
        Make the response:
        - Warm and encouraging
        - Explain WHY these times work well
        - Give a quick tip for success
        - Mention urgency appropriately if it's high
        - Keep it conversational (2-3 sentences)
        
        Example tone: "Great! I've scheduled your guitar practice for Monday, Wednesday, and Friday at 7pm. These evening sessions give you time to unwind after work while building consistent practice habits. Pro tip: keep your guitar visible so you're more likely to stick with it!"
        `;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error(`Error generating explanation: ${error}`);
      return this.createSimpleExplanation(
        scheduledTimes,
        activityName,
        urgency
      );
    }
  }

  formatTimesForExplanation(scheduledTimes) {
    if (!scheduledTimes.length) return "No times scheduled";

    const formatted = scheduledTimes.map((time) =>
      time.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    );

    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
    return (
      formatted.slice(0, -1).join(", ") +
      `, and ${formatted[formatted.length - 1]}`
    );
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

  getUrgencyContext(urgency, activityInfo) {
    if (urgency === "high") {
      let deadline = "";
      if (activityInfo.toLowerCase().includes("deadline:")) {
        const deadlineLine = activityInfo
          .split("\n")
          .find((line) => line.toLowerCase().includes("deadline:"));
        if (deadlineLine) deadline = deadlineLine;
      }

      return `
            IMPORTANT: This is HIGH URGENCY. ${deadline}
            Mention the urgency and encourage them to stick to this intensive schedule.
            Be supportive but emphasize the importance of following through.
            `;
    } else if (urgency === "medium") {
      return "This has medium urgency - mention that consistency will be key to meeting their goal.";
    } else {
      return "This is a regular hobby/goal - focus on building sustainable habits.";
    }
  }

  createSimpleExplanation(scheduledTimes, activityName, urgency) {
    const timesText = this.formatTimesForExplanation(scheduledTimes);

    if (urgency === "high") {
      return `⚡ Urgent schedule created! I've scheduled ${activityName} for ${timesText}. This intensive schedule will help you meet your deadline - stick with it!`;
    } else {
      return `Perfect! I've scheduled ${activityName} for ${timesText}. These consistent sessions will help you build great habits. You've got this! 🎯`;
    }
  }
}

module.exports = OpenAIClient;
