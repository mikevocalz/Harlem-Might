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

/**
 * Panels sit on an arc at the 1.5 m design distance, each turned to face the
 * viewer, slightly below eye level (Meta comfort zone: 1.0-2.0 m, content
 * within about 30 degrees of centre, no panel wider than 50 degrees).
 */
const VIEW_RADIUS = 1.5;
function onArc(degrees: number, y: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const rad = (degrees * Math.PI) / 180;
  return {
    position: [VIEW_RADIUS * Math.sin(rad), y, -VIEW_RADIUS * Math.cos(rad)],
    rotation: [0, -degrees, 0],
  };
}
const VIDEO_AT = onArc(-26, -0.12);
const RIVE_AT = onArc(-26, 0.58);
const DASHBOARD_AT = onArc(26, -0.02);

export function ViroExternalTestScene(): React.ReactElement {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <SpatialPanel
        title="Harlem Courts"
        subtitle="Pickup games, last 7 days"
        width={1.3}
        height={0.95}
        {...DASHBOARD_AT}
      >
        <PanelStack>
          <PanelRow>
            <PanelStack gap={0.012}>
              <PanelImage source={PALACE} width={0.5} height={0.3} />
              <PanelLabel text="Rucker Park, 155th St" variant="caption" />
            </PanelStack>
            <PanelBarChart data={WEEK} width={0.6} height={0.36} />
          </PanelRow>
          <PanelRow>
            <PanelStat value="159" caption="games this week" width={0.36} />
            <PanelStat value="41" caption="Saturday peak" width={0.36} />
            <PanelStat value="+18%" caption="vs last week" width={0.36} />
          </PanelRow>
          <PanelLabel text="About the courts" variant="heading" />
          <PanelLabel text={ABOUT} variant="body" wrap />
          <PanelLabel text="Upcoming runs" variant="heading" />
          {RUNS.map((run) => (
            <PanelSurface key={run.title} width={1.1} height={0.13}>
              <PanelRow gap={0.02}>
                <PanelImage source={run.image} width={0.1} height={0.1} />
                <PanelStack gap={0.006}>
                  <PanelLabel text={run.title} variant="label" width={0.92} />
                  <PanelLabel text={run.detail} variant="caption" width={0.92} />
                </PanelStack>
              </PanelRow>
            </PanelSurface>
          ))}
        </PanelStack>
      </SpatialPanel>

      <VideoPlayerPanel
        title="Courtside"
        source={{ uri: DEMO_VIDEO }}
        width={1.1}
        height={0.78}
        defaultLoop
        {...VIDEO_AT}
      />

      <RivePanel
        tag="platform-lab-lesson"
        width={0.9}
        height={0.5625}
        {...RIVE_AT}
        baked={RIVE_BAKES["platform-lab-lesson"]}
        onButtonPress={(id) => console.log("[viro-external] rive button", id)}
      />
    </ViroScene>
  );
}
