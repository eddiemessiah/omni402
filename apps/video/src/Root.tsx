import { Composition } from "remotion";
import { Omni402Demo } from "./Omni402Demo";

/**
 * 30 seconds at 30fps = 900 frames, 1920x1080.
 * Six scenes of 150 frames each, so the timing is easy to reason about.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Omni402Demo"
    component={Omni402Demo}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
  />
);
