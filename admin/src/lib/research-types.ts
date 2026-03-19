export interface ResearchResult {
  name: string;
  type: "bar" | "restaurant" | "distributor" | "competitor" | "hotel" | "other";
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  relevanceScore: number; // 1-10
  relevanceReasoning: string;
  keyDetails: string;
  categoryTags: string[];
  suggestion: string;
  outreachIdea: string;
}

export interface ResearchSession {
  id: string;
  query: string;
  template_used: string | null;
  results: ResearchResult[];
  result_count: number;
  admin_user_id: string;
  created_at: string;
}

export interface DeepDiveResult {
  name: string;
  enrichedDetails: string;
  recentNews: string[];
  socialMedia: { platform: string; url: string }[];
  menuAnalysis?: string;
  productCatalog?: string;
  competitivePosition?: string;
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
  };
}

export interface PostSearchFilters {
  types: Set<string>;
  minScore: number;
  hasWebsite: boolean;
  hasPhone: boolean;
  activeTags: string[];
}

export interface ResearchTemplate {
  label: string;
  prompt: string;
  icon: string;
}

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
  {
    label: "Find clients in {city}",
    prompt: "Find bars, restaurants, and hotels in {city}, Germany that might be interested in importing Mexican spirits (mezcal, tequila, raicilla). Focus on cocktail bars, Mexican restaurants, and upscale venues.",
    icon: "MapPin",
  },
  {
    label: "Find distributors in {region}",
    prompt: "Find spirits distributors and beverage wholesalers in {region}, Germany that handle premium or craft spirits. Look for those already carrying mezcal, tequila, or other agave spirits.",
    icon: "Truck",
  },
  {
    label: "Analyze competitors importing {type}",
    prompt: "Analyze companies importing {type} spirits into Germany. Find their product lines, pricing strategies, distribution networks, and market positioning. Identify gaps Mecanova could exploit.",
    icon: "Target",
  },
  {
    label: "Research {business name}",
    prompt: "Research {business name} thoroughly. Find their menu, spirit selection, social media presence, reviews, ownership details, and any recent news. Assess their fit as a potential Mecanova client.",
    icon: "Building2",
  },
];
