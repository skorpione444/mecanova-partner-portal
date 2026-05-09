import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  UtensilsCrossed,
  Wine,
  Music,
  PartyPopper,
  Package,
  ChefHat,
  Flame,
} from "lucide-react";

export interface SearchCategory {
  key: string;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
}

export const SEARCH_CATEGORIES: SearchCategory[] = [
  {
    key: "hotels",
    label: "Hotels",
    Icon: BedDouble,
    keywords: ["hotel", "boutique hotel", "design hotel", "resort", "hotel bar", "5 sterne hotel"],
  },
  {
    key: "restaurants",
    label: "Restaurants",
    Icon: UtensilsCrossed,
    keywords: ["restaurant", "fine dining", "bistro", "gastropub", "gourmet restaurant", "brasserie"],
  },
  {
    key: "bars",
    label: "Bars & Lounges",
    Icon: Wine,
    keywords: ["cocktail bar", "speakeasy", "lounge bar", "rooftop bar", "hotel bar", "whisky bar", "bar"],
  },
  {
    key: "clubs",
    label: "Clubs & Nightlife",
    Icon: Music,
    keywords: ["nightclub", "dance club", "disco", "club", "nightlife", "late night bar"],
  },
  {
    key: "events",
    label: "Beach & Events",
    Icon: PartyPopper,
    keywords: ["beach bar", "event location", "event venue", "biergarten", "hochzeitslocation", "party location"],
  },
  {
    key: "wholesale",
    label: "Wholesalers",
    Icon: Package,
    keywords: [
      "Getränkehandel",
      "Getränkemarkt",
      "Getränkegroßhandel",
      "Spirituosenhandel",
      "beverage wholesale",
      "bottle shop",
    ],
  },
  {
    key: "catering",
    label: "Caterers",
    Icon: ChefHat,
    keywords: ["catering", "event catering", "party catering", "mobile bar", "hospitality services"],
  },
  {
    key: "latino",
    label: "Latino / Mexican",
    Icon: Flame,
    keywords: [
      "mexican restaurant",
      "taqueria",
      "cantina",
      "tex-mex",
      "latin restaurant",
      "latin bar",
      "latin club",
      "latino store",
      "mexican shop",
    ],
  },
];
