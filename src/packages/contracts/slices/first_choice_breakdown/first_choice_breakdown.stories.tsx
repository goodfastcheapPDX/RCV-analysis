import type { Meta, StoryObj } from "@storybook/react";
import type { Output } from "./index.contract";
import { FirstChoiceBreakdownView } from "./view";

const meta = {
  title: "Slices/FirstChoiceBreakdown",
  component: FirstChoiceBreakdownView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FirstChoiceBreakdownView>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData: Output[] = [
  { candidate_name: "ALICE HARDESTY", first_choice_votes: 4, pct: 33.3333 },
  { candidate_name: "CANDACE AVALOS", first_choice_votes: 3, pct: 25.0 },
  { candidate_name: "OLIVIA CLARK", first_choice_votes: 2, pct: 16.6667 },
  { candidate_name: "STEVE NOVICK", first_choice_votes: 2, pct: 16.6667 },
  { candidate_name: "TIFFANY KOYAMA LANE", first_choice_votes: 1, pct: 8.3333 },
];

const largerSampleData: Output[] = [
  { candidate_name: "ALICE HARDESTY", first_choice_votes: 1250, pct: 35.2 },
  { candidate_name: "CANDACE AVALOS", first_choice_votes: 980, pct: 27.6 },
  { candidate_name: "OLIVIA CLARK", first_choice_votes: 675, pct: 19.0 },
  { candidate_name: "STEVE NOVICK", first_choice_votes: 423, pct: 11.9 },
  { candidate_name: "TIFFANY KOYAMA LANE", first_choice_votes: 223, pct: 6.3 },
];

const longNameData: Output[] = [
  {
    candidate_name: "ALICE MARIE HARDESTY-JOHNSON",
    first_choice_votes: 850,
    pct: 34.0,
  },
  {
    candidate_name: "CANDACE MARIA AVALOS-RODRIGUEZ",
    first_choice_votes: 720,
    pct: 28.8,
  },
  {
    candidate_name: "OLIVIA ELIZABETH CLARK-WILLIAMS",
    first_choice_votes: 510,
    pct: 20.4,
  },
  {
    candidate_name: "STEVE MICHAEL NOVICK-BROWN",
    first_choice_votes: 290,
    pct: 11.6,
  },
  {
    candidate_name: "TIFFANY LYNN KOYAMA-LANE-SMITH",
    first_choice_votes: 130,
    pct: 5.2,
  },
];

export const Default: Story = {
  args: {
    data: sampleData,
  },
};

export const LargerNumbers: Story = {
  args: {
    data: largerSampleData,
  },
};

export const LongCandidateNames: Story = {
  args: {
    data: longNameData,
  },
};

export const SingleCandidate: Story = {
  args: {
    data: [
      { candidate_name: "ALICE HARDESTY", first_choice_votes: 100, pct: 100.0 },
    ],
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};
