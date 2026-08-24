export type SocialPlatform = "X" | "Instagram" | "TikTok" | "YouTube";

export type GroupStat = {
  slug: string;
  name: string;
  totalFollowers: number;
  monthlyGain: number;
  monthlyGrowthRate: number;
  platforms: Record<SocialPlatform, number>;
};

// Placeholder values for visual development only. These are NOT measurements.
export const groupStats: GroupStat[] = [
  {
    slug: "fruits-zipper",
    name: "FRUITS ZIPPER",
    totalFollowers: 5050000,
    monthlyGain: 182000,
    monthlyGrowthRate: 3.74,
    platforms: { X: 690000, Instagram: 980000, TikTok: 2700000, YouTube: 680000 },
  },
  {
    slug: "candy-tune",
    name: "CANDY TUNE",
    totalFollowers: 3290000,
    monthlyGain: 254000,
    monthlyGrowthRate: 8.36,
    platforms: { X: 420000, Instagram: 650000, TikTok: 1770000, YouTube: 450000 },
  },
  {
    slug: "sweet-steady",
    name: "SWEET STEADY",
    totalFollowers: 1510000,
    monthlyGain: 96000,
    monthlyGrowthRate: 6.79,
    platforms: { X: 260000, Instagram: 350000, TikTok: 650000, YouTube: 250000 },
  },
  {
    slug: "cutie-street",
    name: "CUTIE STREET",
    totalFollowers: 3740000,
    monthlyGain: 318000,
    monthlyGrowthRate: 9.29,
    platforms: { X: 510000, Instagram: 720000, TikTok: 2050000, YouTube: 460000 },
  },
  {
    slug: "more-star",
    name: "MORE STAR",
    totalFollowers: 940000,
    monthlyGain: 121000,
    monthlyGrowthRate: 14.78,
    platforms: { X: 150000, Instagram: 210000, TikTok: 470000, YouTube: 110000 },
  },
];

export const timeline = [
  { month: "Mar", "FRUITS ZIPPER": 4220000, "CANDY TUNE": 2200000, "SWEET STEADY": 1020000, "CUTIE STREET": 2440000, "MORE STAR": 470000 },
  { month: "Apr", "FRUITS ZIPPER": 4380000, "CANDY TUNE": 2390000, "SWEET STEADY": 1110000, "CUTIE STREET": 2680000, "MORE STAR": 550000 },
  { month: "May", "FRUITS ZIPPER": 4550000, "CANDY TUNE": 2600000, "SWEET STEADY": 1210000, "CUTIE STREET": 2970000, "MORE STAR": 640000 },
  { month: "Jun", "FRUITS ZIPPER": 4720000, "CANDY TUNE": 2840000, "SWEET STEADY": 1320000, "CUTIE STREET": 3260000, "MORE STAR": 720000 },
  { month: "Jul", "FRUITS ZIPPER": 4868000, "CANDY TUNE": 3036000, "SWEET STEADY": 1414000, "CUTIE STREET": 3422000, "MORE STAR": 819000 },
  { month: "Aug", "FRUITS ZIPPER": 5050000, "CANDY TUNE": 3290000, "SWEET STEADY": 1510000, "CUTIE STREET": 3740000, "MORE STAR": 940000 },
];

export const demoNotice = "DEMO ONLY — displayed follower counts and growth values are fictional placeholders for UI development. Official account mappings are verified separately; no placeholder statistic should be published as real data.";
