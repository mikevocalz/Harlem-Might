/**
 * Headset test bed for @viro-external/ui: the same dashboard, video panel and
 * Rive panel the Specs build renders in Lens Studio
 * (viro-external-specs-preview/packages/specs/examples/harlem-courts.tsx),
 * with native sources in place of Lens registry ids.
 */
import React from "react";
import { Image } from "react-native";
import {
  ViroAmbientLight,
  ViroNode,
  ViroScene,
} from "@reactvision/react-viro";
import {
  PanelBarChart,
  PanelImage,
  PanelLabel,
  PanelRow,
  PanelStack,
  PanelStat,
  PanelSurface,
  RivePanel,
  SpatialPanel,
  VideoPlayerPanel,
} from "@viro-external/ui";
import { RIVE_BAKES } from "../assets/viro-external-test/rive";

const PALACE = require("../assets/viro-external-test/viro-row-palace.jpg");
const CACTUS = require("../assets/viro-external-test/viro-row-cactus.jpg");
const DOG = require("../assets/viro-external-test/viro-row-dog.jpg");
const DEMO_VIDEO = Image.resolveAssetSource(require("../assets/viro-external-test/demo.mp4")).uri;

const WEEK = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 9 },
  { label: "Thu", value: 22 },
  { label: "Fri", value: 30 },
  { label: "Sat", value: 41 },
  { label: "Sun", value: 27 },
];

const ABOUT =
  "Rucker Park has hosted pickup basketball on 155th Street since the 1950s, " +
  "and the courts still fill from the first warm weekend in spring until the " +
  "lights go off in October. Games run to 21 by ones and twos, winners stay on, " +
  "and the next five call it from the fence.";

const RUNS = [
  { title: "Saturday Morning Run", detail: "8:00 AM  ·  Court 1  ·  open", image: PALACE },
  { title: "Over-35 League", detail: "6:30 PM  ·  Court 2  ·  12 signed up", image: CACTUS },
  { title: "Youth Clinic", detail: "Sun 10:00 AM  ·  both courts", image: DOG },
];

export function ViroExternalTestScene(): React.ReactElement {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroNode position={[0, 0, -1.5]}>
        <ViroNode position={[0, 0.42, 0]}>
          <PanelLabel text="viro-external on Quest" variant="title" width={1.2} />
        </ViroNode>

        <SpatialPanel
          title="Harlem Courts"
          subtitle="Pickup games, last 7 days"
          width={0.9}
          height={0.6}
          position={[0.5, 0.02, 0]}
        >
          <PanelStack>
            <PanelRow>
              <PanelStack gap={0.012}>
                <PanelImage source={PALACE} width={0.34} height={0.22} />
                <PanelLabel text="Rucker Park, 155th St" variant="caption" />
              </PanelStack>
              <PanelBarChart data={WEEK} width={0.4} height={0.24} />
            </PanelRow>
            <PanelRow>
              <PanelStat value="159" caption="games this week" width={0.24} />
              <PanelStat value="41" caption="Saturday peak" width={0.24} />
              <PanelStat value="+18%" caption="vs last week" width={0.24} />
            </PanelRow>
            <PanelLabel text="About the courts" variant="heading" />
            <PanelLabel text={ABOUT} variant="body" wrap />
            <PanelLabel text="Upcoming runs" variant="heading" />
            {RUNS.map((run) => (
              <PanelSurface key={run.title} width={0.78} height={0.088}>
                <PanelRow gap={0.02}>
                  <PanelImage source={run.image} width={0.07} height={0.07} />
                  <PanelStack gap={0.006}>
                    <PanelLabel text={run.title} variant="label" width={0.6} />
                    <PanelLabel text={run.detail} variant="caption" width={0.6} />
                  </PanelStack>
                </PanelRow>
              </PanelSurface>
            ))}
          </PanelStack>
        </SpatialPanel>

        <VideoPlayerPanel
          title="Courtside"
          source={{ uri: DEMO_VIDEO }}
          width={0.6}
          height={0.4}
          defaultLoop
          position={[-0.46, 0.0, 0]}
        />

        <RivePanel
          tag="platform-lab-lesson"
          width={0.56}
          height={0.35}
          position={[-0.46, 0.46, 0]}
          baked={RIVE_BAKES["platform-lab-lesson"]}
          onButtonPress={(id) => console.log("[viro-external] rive button", id)}
        />
      </ViroNode>
    </ViroScene>
  );
}
