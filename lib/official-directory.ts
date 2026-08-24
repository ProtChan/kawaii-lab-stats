import project from "@/data/directory/project.json";
import fruitsZipper from "@/data/directory/fruits-zipper.json";
import candyTune from "@/data/directory/candy-tune.json";
import sweetSteady from "@/data/directory/sweet-steady.json";
import cutieStreet from "@/data/directory/cutie-street.json";
import moreStar from "@/data/directory/more-star.json";
import piki from "@/data/directory/piki.json";
import mates from "@/data/directory/kawaii-lab-mates.json";
import south from "@/data/directory/kawaii-lab-south.json";

export type DirectoryAccount = {
  platform: "X" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  handle: string;
  url: string;
  platformId?: string;
  sourceUrl?: string;
};

export type DirectoryMember = {
  slug: string;
  name: string;
  notes?: string;
  status?: "ACTIVE" | "HIATUS" | "INACTIVE";
  statusSourceUrl?: string;
  relationOnly?: boolean;
  accounts: DirectoryAccount[];
};

export type DirectoryGroup = {
  slug: string;
  name: string;
  type: "GROUP";
  category: string;
  verifiedAt: string;
  sourceUrl: string;
  accounts: DirectoryAccount[];
  members: DirectoryMember[];
};

export const officialProject = project;
export const officialGroups = [
  fruitsZipper,
  candyTune,
  sweetSteady,
  cutieStreet,
  moreStar,
  piki,
  mates,
  south,
] as DirectoryGroup[];

export const debutedGroups = officialGroups.filter((group) => group.category === "DEBUTED");
export const specialUnits = officialGroups.filter((group) => group.category === "SPECIAL_UNIT");
export const traineeGroups = officialGroups.filter((group) => group.category === "TRAINEE");

const uniqueMemberSlugs = new Set(
  officialGroups.flatMap((group) => group.members.map((member) => member.slug)),
);

export const directorySummary = {
  groups: officialGroups.length,
  debutedGroups: debutedGroups.length,
  specialUnits: specialUnits.length,
  traineeGroups: traineeGroups.length,
  members: uniqueMemberSlugs.size,
  accounts:
    project.accounts.length +
    officialGroups.reduce(
      (sum, group) => sum + group.accounts.length + group.members.reduce((memberSum, member) => memberSum + member.accounts.length, 0),
      0,
    ),
};
