import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PROOF, T } from "./proof";

/* ---------------- shared pieces ---------------- */

const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const w = interpolate(frame - delay, [0, 22], [0, 44], { extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: o, marginBottom: 26 }}>
      <div style={{ width: w, height: 4, background: T.orange }} />
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 22,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: T.orange,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Headline that rises into view, one line at a time. */
const Rise: React.FC<{
  lines: React.ReactNode[];
  size?: number;
  delay?: number;
  color?: string;
}> = ({ lines, size = 92, delay = 0, color = T.ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div>
      {lines.map((l, i) => {
        const s = spring({
          frame: frame - delay - i * 6,
          fps,
          config: { damping: 200, stiffness: 90 },
        });
        return (
          <div key={i} style={{ overflow: "hidden", height: size * 1.02 }}>
            <div
              style={{
                transform: `translateY(${interpolate(s, [0, 1], [110, 0])}%)`,
                fontFamily: T.disp,
                fontWeight: 900,
                fontSize: size,
                lineHeight: 1.02,
                letterSpacing: "-0.035em",
                textTransform: "uppercase",
                color,
              }}
            >
              {l}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Body: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({
  children,
  delay = 20,
  color = T.ink2,
}) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame - delay, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  return (
    <p
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)`,
        fontFamily: T.disp,
        fontSize: 34,
        lineHeight: 1.45,
        color,
        maxWidth: 1180,
        margin: "30px 0 0",
        fontWeight: 500,
      }}
    >
      {children}
    </p>
  );
};

/** Monospace block that types itself out character by character. */
const Typed: React.FC<{ text: string; delay?: number; cps?: number; color?: string }> = ({
  text,
  delay = 0,
  cps = 34,
  color = "#eee",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((frame - delay) / fps) * cps));
  const shown = text.slice(0, n);
  const done = n >= text.length;
  return (
    <span style={{ color }}>
      {shown}
      {!done && (
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 26,
            background: T.orange,
            verticalAlign: -4,
          }}
        />
      )}
    </span>
  );
};

const Panel: React.FC<{ children: React.ReactNode; delay?: number; accent?: string }> = ({
  children,
  delay = 0,
  accent = "#2a2a26",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
        background: "#141412",
        border: `2px solid ${accent}`,
        padding: 40,
        fontFamily: T.mono,
        fontSize: 27,
        lineHeight: 1.7,
        marginTop: 34,
      }}
    >
      {children}
    </div>
  );
};

const Card: React.FC<{ k: string; title: string; body: string; delay?: number }> = ({
  k,
  title,
  body,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        flex: 1,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [32, 0])}px)`,
        border: "2px solid #2a2a26",
        background: "#111110",
        padding: 32,
      }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 18,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: T.orange,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: T.disp,
          fontWeight: 800,
          fontSize: 38,
          color: T.paper,
          margin: "12px 0 8px",
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: T.disp, fontSize: 25, color: "#a7a49b", lineHeight: 1.4 }}>
        {body}
      </div>
    </div>
  );
};

const Pad: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <AbsoluteFill
    style={{
      background: dark ? T.black : T.paper,
      padding: "96px 110px",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

/* ---------------- the film ---------------- */

export const Omni402Demo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: T.paper, fontFamily: T.disp }}>
      {/* 1. Title (0-150) */}
      <Sequence from={0} durationInFrames={150}>
        <Pad>
          <Kicker>Celo Agentic Payments and DeFAI</Kicker>
          <Rise lines={["Any API.", <>Now something an <span style={{ color: T.orange }}>agent can pay for.</span></>]} size={104} />
          <Body delay={34}>
            Wrap any HTTP API into a pay-per-call endpoint on Celo. Agents pay per request in USDC.
            No account. No key. No gas.
          </Body>
          <div
            style={{
              marginTop: 40,
              opacity: interpolate(frame, [50, 66], [0, 1], { extrapolateRight: "clamp" }),
              display: "inline-block",
              background: T.orange,
              color: "#160a04",
              fontFamily: T.mono,
              fontWeight: 700,
              fontSize: 26,
              padding: "12px 20px",
              alignSelf: "flex-start",
            }}
          >
            {PROOF.site.replace("https://", "")}
          </div>
        </Pad>
      </Sequence>

      {/* 2. The wall (150-300) */}
      <Sequence from={150} durationInFrames={150}>
        <Pad>
          <Kicker>The wall</Kicker>
          <Rise lines={["APIs were built for humans.", "Machines can't sign up."]} size={82} />
          <Body delay={30}>
            A person creates the key, configures it, and hands it to the agent. There is a human in
            the middle of every machine transaction.
          </Body>
        </Pad>
      </Sequence>

      {/* 3. One command (300-450) */}
      <Sequence from={300} durationInFrames={150}>
        <Pad dark>
          <Kicker>The fix</Kicker>
          <Rise
            lines={["One command turns any API", "into an agent-payable endpoint."]}
            size={70}
            color={T.paper}
          />
          <Panel delay={26}>
            <span style={{ color: T.orange }}>$ </span>
            <Typed
              delay={30}
              text={`npx x402ify https://api.example.com --price 0.01 --wallet 0xYourWallet`}
            />
          </Panel>
          <Body delay={92} color="#a7a49b">
            No payment code. No metering stack. Your upstream key never leaves your machine.
          </Body>
        </Pad>
      </Sequence>

      {/* 4. The 402 gate (450-600) */}
      <Sequence from={450} durationInFrames={150}>
        <Pad dark>
          <Kicker>Live on Celo mainnet</Kicker>
          <Rise lines={["The gate is real."]} size={82} color={T.paper} />
          <Panel delay={18}>
            <div style={{ color: "#8f8c84" }}>
              $ curl -i {PROOF.gateway}/pay/{PROOF.lane}
            </div>
            <div style={{ color: T.orange, fontWeight: 700, marginTop: 18 }}>
              <Typed delay={30} text="HTTP/1.1 402 Payment Required" cps={26} color={T.orange} />
            </div>
            <div style={{ color: "#eee", marginTop: 14, opacity: interpolate(frame - 450, [60, 74], [0, 1], { extrapolateRight: "clamp" }) }}>
              "maxAmountRequired": "1000", <span style={{ color: "#8f8c84" }}>// 0.001 USDC</span>
              <br />
              "asset": "0xcEBA9300…32118C", <span style={{ color: "#8f8c84" }}>// Celo USDC</span>
              <br />
              "network": "{PROOF.caip2}" <span style={{ color: "#8f8c84" }}>// Celo mainnet</span>
            </div>
          </Panel>
        </Pad>
      </Sequence>

      {/* 5. Settlement, verified (600-750) */}
      <Sequence from={600} durationInFrames={150}>
        <Pad dark>
          <Kicker>Settled, gasless</Kicker>
          <Rise lines={["The agent paid. On its own."]} size={74} color={T.paper} />
          <Panel delay={16} accent={T.green}>
            <div style={{ color: T.green, fontWeight: 700 }}>
              <Typed delay={26} text={`paid ${PROOF.amountUsdc} USDC  →  Celo Token Prices`} cps={24} color={T.green} />
            </div>
            <div
              style={{
                color: "#a7a49b",
                marginTop: 18,
                fontSize: 24,
                opacity: interpolate(frame - 600, [56, 70], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              buyer     {PROOF.buyer.slice(0, 14)}…{PROOF.buyer.slice(-4)}
              <br />
              seller    {PROOF.seller.slice(0, 14)}…{PROOF.seller.slice(-4)}
              <br />
              gas       paid by the Celo facilitator, not the buyer
              <br />
              block     {PROOF.block.toLocaleString()}
            </div>
            <div
              style={{
                marginTop: 22,
                color: T.orange,
                fontSize: 21,
                wordBreak: "break-all",
                opacity: interpolate(frame - 600, [78, 92], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              {PROOF.celoscan}
            </div>
          </Panel>
        </Pad>
      </Sequence>

      {/* 6. Full stack and close (750-900) */}
      <Sequence from={750} durationInFrames={150}>
        <Pad dark>
          <Kicker>Identity. Payments. Discovery.</Kicker>
          <Rise lines={["The machine economy,", "running on Celo."]} size={72} color={T.paper} />
          <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
            <Card k="Identity" title="ERC-8004" body={`On-chain agent #${PROOF.agentId}, reputation-ready.`} delay={26} />
            <Card k="Payments" title="x402 / MPP" body="Gasless USDC per request via Celo." delay={34} />
            <Card k="Discovery" title="MCP" body="Agents find and buy services alone." delay={42} />
          </div>
          <Body delay={62} color="#a7a49b">
            {PROOF.site.replace("https://", "")} &nbsp;·&nbsp; {PROOF.repo.replace("https://", "")}
          </Body>
        </Pad>
      </Sequence>
    </AbsoluteFill>
  );
};
