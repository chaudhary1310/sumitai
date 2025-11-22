import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // Run every Sunday at midnight
  async ({ event, step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
        Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
        {
          "salaryRanges": [
            { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
          ],
          "growthRate": number,
          "demandLevel": "High" | "Medium" | "Low",
          "topSkills": ["skill1", "skill2"],
          "marketOutlook": "Positive" | "Neutral" | "Negative",
          "keyTrends": ["trend1", "trend2"],
          "recommendedSkills": ["skill1", "skill2"]
        }

        IMPORTANT:
        - Return ONLY valid JSON.
        - No extra text, comments, or markdown.
        - Include at least 5 common roles for salary ranges.
        - Growth rate should be a percentage.
        - Include at least 5 skills and trends.
      `;

      const response = await step.ai.wrap(
        "gemini-cron",
        async (p) => {
          return await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [{ text: p }],
              },
            ],
            config: {
              responseMimeType: "application/json", // strict JSON
            },
          });
        },
        prompt
      );

      const text = response.text;

      if (!text) {
        console.error(`Empty response from Gemini for industry: ${industry}`, response);
        continue; // or throw, up to you
      }

      let insights;
      try {
        insights = JSON.parse(text);
      } catch (err) {
        console.error(`Failed to parse JSON for ${industry}:`, text, err);
        continue;
      }

      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);
