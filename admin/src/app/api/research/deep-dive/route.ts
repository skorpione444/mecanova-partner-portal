import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { DeepDiveResult } from "@/lib/research-types";

const SYSTEM_PROMPT = `You are a business research assistant for Mecanova, a Mexican spirits importer in Germany. You are performing a deep-dive research on a specific business.

Search thoroughly for:
- Detailed business information (ownership, size, history)
- Recent news and press mentions
- Social media profiles (Instagram, Facebook, LinkedIn, etc.)
- Menu analysis (if restaurant/bar — look for cocktail programs, spirit selections)
- Product catalog (if distributor/competitor — what spirits they carry)
- Competitive positioning (market niche, pricing tier, target audience)
- Contact information (email, phone, address, website)

You MUST respond with ONLY valid JSON matching this schema:
{
  "name": "string",
  "enrichedDetails": "string with comprehensive business overview",
  "recentNews": ["array of recent news items or press mentions"],
  "socialMedia": [{"platform": "string", "url": "string"}],
  "menuAnalysis": "string or null (only for bars/restaurants)",
  "productCatalog": "string or null (only for distributors/competitors)",
  "competitivePosition": "string or null",
  "contactInfo": {
    "email": "string or null",
    "phone": "string or null",
    "address": "string or null",
    "website": "string or null"
  }
}

Be thorough — use multiple web searches to find comprehensive information.`;

export async function POST(request: Request) {
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
  const { businessName, businessType, existingDetails } = body;

  if (!businessName) {
    return NextResponse.json(
      { error: "Business name is required" },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userMessage = `Deep-dive research on: ${businessName}
Type: ${businessType || "unknown"}
What we already know: ${existingDetails || "Nothing yet"}

Find everything you can about this business — comprehensive details, news, social media, contact info, and analysis relevant to a spirits import partnership.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 15,
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    let resultText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        resultText += block.text;
      }
    }

    let jsonStr = resultText;
    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let result: DeepDiveResult;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      const objMatch = resultText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        result = JSON.parse(objMatch[0]);
      } else {
        return NextResponse.json(
          { error: "Failed to parse deep-dive results" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Deep-dive API error:", error);
    return NextResponse.json(
      { error: "Deep-dive request failed" },
      { status: 500 }
    );
  }
}
