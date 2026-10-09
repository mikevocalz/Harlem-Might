/**
 * Headset test bed for @viro-external/ui: a dashboard panel and a video
 * panel at the 1.5 m design distance. The old JSX panel kit (PanelStack,
 * PanelRow, PanelStat, PanelBarChart, RivePanel) was replaced upstream by
 * absolute-positioned children plus a native Rive surface contract
 * (createRiveSpatialSurface) that has no host in the Viro fork yet, so no
 * Rive panel is mounted here — see docs/adr/0005.
 */
import React from "react";
import { Image } from "react-native";
import {
  ViroAmbientLight,
  ViroNode,
  ViroQuad,
  ViroScene,
  ViroText,
} from "@reactvision/react-viro";
import {
  PanelImage,
  PanelText,
  SpatialPanel,
  SpatialScrollView,
  VideoPlayerPanel,
} from "@viro-external/ui";
// Package-internal material registry: the exported panels register it on
// render; the chart and stat tiles below need the same names.
import {
  PremiumMaterials,
  registerPremiumMaterials,
} from "@viro-external/ui/src/materials";

const PALACE = require("../assets/viro-external-test/viro-row-palace.jpg");
const CACTUS = require("../assets/viro-external-test/viro-row-cactus.jpg");
const DOG = require("../assets/viro-external-test/viro-row-dog.jpg");
const DEMO_VIDEO = Image.resolveAssetSource(require("../assets/viro-external-test/demo.mp4")).uri;

// Pre-rewrite PANEL_TYPE scale (viro-external ce88d7d): figure 28, heading
// 22, label 18, body 16, caption 14.
const TYPE = { figure: 28, heading: 22, label: 18, body: 16, caption: 14 };
const MUTED = "#A7ADBF";

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
 * viewer, slightly below eye level (Meta comfort zone: 1.0-2.0 m). The outer
 * edges stay within about 40 degrees of centre, inside the field both eyes
 * share on Quest; past it an edge shows in one eye only.
 */
const VIEW_RADIUS = 1.5;
function onArc(degrees: number, y: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const rad = (degrees * Math.PI) / 180;
  return {
    position: [VIEW_RADIUS * Math.sin(rad), y, -VIEW_RADIUS * Math.cos(rad)],
    rotation: [0, -degrees, 0],
  };
}
const VIDEO_AT = onArc(-19, -0.1);
const DASHBOARD_AT = onArc(19, -0.04);

/** Weekly bars; replicates the removed PanelBarChart's geometry. */
function ChartBars({
  data,
  width,
  height,
}: {
  data: readonly { label: string; value: number }[];
  width: number;
  height: number;
}) {
  registerPremiumMaterials();
  const labelBand = 0.05;
  const barMax = height - labelBand * 2 - 0.01;
  const baseline = -height / 2 + labelBand + 0.004;
  const slot = width / data.length;
  const peak = Math.max(1, ...data.map((d) => d.value));
  return (
    <ViroNode>
      {data.map((d, i) => {
        const barHeight = Math.max(0.01, (d.value / peak) * barMax);
        const x = -width / 2 + slot * i + slot / 2;
        return (
          <ViroNode key={d.label}>
            <ViroQuad
              position={[x, baseline + barHeight / 2, 0]}
              width={slot * 0.55}
              height={barHeight}
              materials={[
                d.value === peak ? PremiumMaterials.thumb : PremiumMaterials.button,
              ]}
            />
            <ViroText
              text={String(d.value)}
              position={[x, baseline + barHeight + labelBand / 2, 0.002]}
              width={0.1}
              height={0.03}
              style={{ fontSize: TYPE.caption, textAlign: "center" }}
            />
            <ViroText
              text={d.label}
              position={[x, baseline - labelBand / 2 - 0.004, 0.002]}
              width={0.1}
              height={0.03}
              style={{ fontSize: TYPE.caption, textAlign: "center", color: MUTED }}
            />
          </ViroNode>
        );
      })}
    </ViroNode>
  );
}

/** Figure-over-caption tile; replaces the removed PanelStat. */
function StatTile({
  value,
  caption,
  width,
  position,
}: {
  value: string;
  caption: string;
  width: number;
  position: [number, number, number];
}) {
  registerPremiumMaterials();
  return (
    <ViroNode position={position}>
      <ViroQuad width={width} height={0.11} materials={[PremiumMaterials.header]} />
      <ViroText
        text={value}
        position={[0, 0.014, 0.004]}
        width={width}
        height={0.05}
        style={{ fontSize: TYPE.figure, textAlign: "center" }}
      />
      <ViroText
        text={caption}
        position={[0, -0.03, 0.004]}
        width={width}
        height={0.03}
        style={{ fontSize: TYPE.caption, textAlign: "center", color: MUTED }}
      />
    </ViroNode>
  );
}

/** One upcoming-run row inside the scroll view. */
function RunRow({ run }: { run: (typeof RUNS)[number] }) {
  return (
    <ViroNode>
      <PanelImage source={run.image} width={0.1} height={0.1} position={[-0.36, 0, 0]} />
      <PanelText
        text={run.title}
        width={0.66}
        height={0.05}
        position={[0.05, 0.02, 0]}
        weight="600"
      />
      <PanelText
        text={run.detail}
        width={0.66}
        height={0.045}
        position={[0.05, -0.035, 0]}
        color={MUTED}
      />
    </ViroNode>
  );
}

export function ViroExternalTestScene(): React.ReactElement {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <SpatialPanel
        title="Harlem Courts"
        subtitle="Pickup games, last 7 days"
        width={1.04}
        height={1.2}
        {...DASHBOARD_AT}
      >
        <PanelImage source={PALACE} width={0.4} height={0.26} position={[-0.30, 0.40, 0]} />
        <PanelText
          text="Rucker Park, 155th St"
          width={0.4}
          height={0.05}
          position={[-0.30, 0.23, 0]}
          color={MUTED}
        />
        <ViroNode position={[0.28, 0.37, 0]}>
          <ChartBars data={WEEK} width={0.46} height={0.34} />
        </ViroNode>

        <StatTile value="159" caption="games this week" width={0.28} position={[-0.32, 0.06, 0]} />
        <StatTile value="41" caption="Saturday peak" width={0.28} position={[0, 0.06, 0]} />
        <StatTile value="+18%" caption="vs last week" width={0.28} position={[0.32, 0.06, 0]} />

        <ViroText
          text="About the courts"
          position={[-0.44, -0.06, 0]}
          width={0.92}
          height={0.05}
          style={{ fontSize: TYPE.heading }}
        />
        <PanelText
          text={ABOUT}
          width={0.92}
          height={0.11}
          position={[0, -0.17, 0]}
        />
        <ViroText
          text="Upcoming runs"
          position={[-0.44, -0.28, 0]}
          width={0.92}
          height={0.05}
          style={{ fontSize: TYPE.heading }}
        />
        <SpatialScrollView
          width={0.86}
          height={0.27}
          itemHeight={0.13}
          position={[0, -0.445, 0]}
        >
          {RUNS.map((run) => (
            <RunRow key={run.title} run={run} />
          ))}
        </SpatialScrollView>
      </SpatialPanel>

      <VideoPlayerPanel
        title="Courtside"
        source={{ uri: DEMO_VIDEO }}
        width={0.92}
        height={0.66}
        defaultLoop
        {...VIDEO_AT}
      />
    </ViroScene>
  );
}
