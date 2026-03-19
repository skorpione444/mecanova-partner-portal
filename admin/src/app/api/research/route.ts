import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ResearchResult } from "@/lib/research-types";

const SYSTEM_PROMPT = `You are a business research assistant for Mecanova, a Mexican spirits importer based in Germany. Mecanova imports premium mezcal, tequila, raicilla, and other agave-based spirits from Mexico and distributes them to bars, restaurants, hotels, and distributors across Germany.

When researching, focus on:
- Relevance to the spirits/beverage industry in Germany
- Quality of the establishment or business
- Likelihood of interest in premium Mexican spirits
- Actionable contact information and details

You MUST respond with ONLY a valid JSON array of results. Each result must match this schema exactly:
{
  "name": "string",
  "type": "bar|restaurant|distributor|competitor|hotel|other",
  "address": "string or null",
  "city": "string or null",
  "phone": "string or null",
  "website": "string or null",
  "relevanceScore": number (1-10),
  "relevanceReasoning": "string explaining why this score",
  "keyDetails": "string with important details about this business",
  "categoryTags": ["array", "of", "tags"],
  "suggestion": "string explaining why Mecanova should care about this result",
  "outreachIdea": "string with a specific, personalized outreach approach"
}

Return between 5-15 results, ordered by relevance score (highest first). Be thorough in your web research — search for real, current businesses. Every result must be a real business you found via web search, not fabricated.`;

export async function POST(request: Request) {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { query, template } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 10,
        },
      ],
      messages: [{ role: "user", content: query }],
    });

    // Extract text from response
    let resultText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        resultText += block.text;
      }
    }

    // Parse JSON from response — handle markdown code blocks
    let jsonStr = resultText;
    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let results: ResearchResult[];
    try {
      results = JSON.parse(jsonStr);
    } catch {
      // Try to find JSON array in the text
      const arrayMatch = resultText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        results = JSON.parse(arrayMatch[0]);
      } else {
        return NextResponse.json(
          { error: "Failed to parse research results" },
          { status: 500 }
        );
      }
    }

    // Ensure results is an array
    if (!Array.isArray(results)) {
      results = [results];
    }

    // Save session to DB
    const { data: session, error: dbError } = await supabase
      .from("research_sessions")
      .insert({
        query,
        template_used: template || null,
        results: JSON.parse(JSON.stringify(results)),
        result_count: results.length,
        admin_user_id: user.id,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Failed to save research session:", dbError);
    }

    return NextResponse.json({
      results,
      sessionId: session?.id || null,
    });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: "Research request failed" },
      { status: 500 }
    );
  }
}
