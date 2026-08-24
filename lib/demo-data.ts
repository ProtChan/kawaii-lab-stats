export type SocialPlatform = "X" | "Instagram" | "TikTok" | "YouTube";

export type GroupStat = {
  slug: string;
  name: string;
  totalFollowers: number;
  monthlyGain: number;
  monthlyGrowthRate: number;
  platforms: Record<SocialPlatform, number>;
};

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
    slug: "cutie-street",
    name: "CUTIE STREET",
    totalFollowers: 3740000,
    monthlyGain: 318000,
    monthlyGrowthRate: 9.29,
    platforms: { X: 510000, Instagram: 720000, TikTok: 2050000, YouTube: 460000 },
  },
  {
    slug: "sweet-steady",
    name: "SWEET STEADY",
    totalFollowers: 1510000,
    monthlyGain: 96000,
    monthlyGrowthRate: 6.79,
    platforms: { X: 260000, Instagram: 350000, TikTok: 650000, YouTube: 250000 },
  },
];

export const timeline = [
  { month: "Mar", "FRUITS ZIPPER": 4220000, "CANDY TUNE": 2200000, "CUTIE STREET": 2440000, "SWEET STEADY": 1020000 },
  { month: "Apr", "FRUITS ZIPPER": 4380000, "CANDY TUNE": 2390000, "CUTIE STREET": 2680000, "SWEET STEADY": 1110000 },
  { month: "May", "FRUITS ZIPPER": 4550000, "CANDY TUNE": 2600000, "CUTIE STREET": 2970000, "SWEET STEADY": 1210000 },
  { month: "Jun", "FRUITS ZIPPER": 4720000, "CANDY TUNE": 2840000, "CUTIE STREET": 3260000, "SWEET STEADY": 1320000 },
  { month: "Jul", "FRUITS ZIPPER": 4868000, "CANDY TUNE": 3036000, "CUTIE STREET": 3422000, "SWEET STEADY": 1414000 },
  { month: "Aug", "FRUITS ZIPPER": 5050000, "CANDY TUNE": 3290000, "CUTIE STREET": 3740000, "SWEET STEADY": 1510000 },
];

export const demoNotice = "Displayed values are placeholder demo data only. Replace them with collected, source-attributed snapshots before publication.";
