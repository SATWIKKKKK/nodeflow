import type { ReactNode } from "react";
import {
  CtaLogoField,
  DiffGraphic,
  FaultGraphic,
  LanguagePills,
  LogoDrawIn,
  PreviewGraphic,
  ProblemDots,
  ReplayScene,
  ReverseListBand,
  RunGraphic,
  RunScene,
  StepLimitGlyph,
  StructureGraph,
  SubmitGraphic,
  TestGraphic,
  TopicSigil,
  TraceScene,
  WriteScene,
  topicSigilNames
} from "../components/graphics";

/**
 * Contact sheet for components/graphics: every illustration, in light and dark,
 * at 1x and 2x. Not linked from anywhere — open /dev/graphics directly.
 */

const scenes: Array<{ name: string; width: number; node: ReactNode }> = [
  { name: "steps/Write", width: 160, node: <WriteScene /> },
  { name: "steps/Run", width: 160, node: <RunScene /> },
  { name: "steps/Trace", width: 160, node: <TraceScene /> },
  { name: "steps/Replay", width: 160, node: <ReplayScene /> },
  { name: "features/Run", width: 280, node: <RunGraphic /> },
  { name: "features/Test", width: 280, node: <TestGraphic /> },
  { name: "features/Submit", width: 280, node: <SubmitGraphic /> },
  { name: "features/Live preview", width: 280, node: <PreviewGraphic /> },
  { name: "features/Diffs", width: 280, node: <DiffGraphic /> },
  { name: "features/Fault", width: 280, node: <FaultGraphic /> },
  { name: "metrics/ProblemDots", width: 96, node: <ProblemDots total={372} /> },
  { name: "metrics/StructureGraph", width: 96, node: <StructureGraph total={74} /> },
  { name: "metrics/LanguagePills", width: 96, node: <LanguagePills /> },
  { name: "metrics/StepLimit", width: 96, node: <StepLimitGlyph /> }
];

function Panel({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div className={dark ? "dark" : undefined}>
      <div className="min-h-full bg-background p-6">
        <p className="mb-6 text-technical-mono text-blueprint-muted">{dark ? "Dark" : "Light"}</p>
        {children}
      </div>
    </div>
  );
}

function Board() {
  return (
    <div className="grid gap-12">
      <section>
        <h2 className="mb-4 text-headline-sm text-primary">Hero band</h2>
        <ReverseListBand />
      </section>

      <section>
        <h2 className="mb-4 text-headline-sm text-primary">Logo draw-in</h2>
        <div className="flex items-end gap-8">
          <LogoDrawIn className="h-10" />
          <LogoDrawIn className="h-20" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-headline-sm text-primary">Scenes</h2>
        <div className="grid gap-8">
          {scenes.map((scene) => (
            <div key={scene.name}>
              <p className="mb-2 text-technical-mono text-blueprint-muted">{scene.name}</p>
              <div className="flex flex-wrap items-start gap-6">
                {[1, 2].map((factor) => (
                  <div key={factor}>
                    <p className="mb-1 font-mono text-[10px] text-blueprint-muted">{factor}x</p>
                    <div
                      className="overflow-hidden rounded-lg border border-blueprint-line"
                      style={{ width: scene.width * factor }}
                    >
                      {scene.node}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-headline-sm text-primary">CTA logo field</h2>
        <div className="relative h-64 overflow-hidden rounded-xl bg-[#050505]">
          <CtaLogoField active className="-right-16 -top-24 h-96 w-96" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-headline-sm text-primary">Topic sigils ({topicSigilNames.length})</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {topicSigilNames.map((topic) => (
            <div key={topic} className="rounded-lg border border-blueprint-line p-3">
              <div className="flex justify-center gap-3">
                <TopicSigil topic={topic} size={64} />
                <TopicSigil topic={topic} size={128} />
              </div>
              <p className="mt-2 text-center font-mono text-[10px] text-blueprint-muted">{topic}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DevGraphicsPage() {
  return (
    <div className="grid lg:grid-cols-2">
      <Panel>
        <Board />
      </Panel>
      <Panel dark>
        <Board />
      </Panel>
    </div>
  );
}
