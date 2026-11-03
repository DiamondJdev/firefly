"use client";

import { useState } from "react";

const examples = [
  {
    name: "CLI",
    title: "A deploy from your terminal",
    description: "The planned pi CLI uploads source, streams build output, and returns your app's URL. Follow its logs from the same terminal.",
  },
  {
    name: "Git",
    title: "A push from your repository",
    code: "$ git add .\n$ git commit -m \"Ship something small\"\n$ git push origin main",
    description: "The planned GitHub integration queues a build on push. Pull requests get their own preview URL, with cleanup after the branch closes.",
  },
  {
    name: "Dockerfile",
    title: "A container you understand",
    code: "FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --omit=dev\nEXPOSE 3000\nCMD [\"npm\", \"start\"]",
    description: "Bring a Dockerfile for a single-container app. This Node example assumes a committed package lock and a start script that listens on port 3000.",
  },
];

export default function Workflow() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];

  return (
    <div className="workflow-example">
      <div className="example-controls" role="group" aria-label="Choose a workflow example">
        {examples.map((item, index) => (
          <button key={item.name} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="example-body" aria-live="polite" aria-atomic="true">
        {selected === 0 ? (
          <pre className="terminal-code" aria-label={example.title}><code>
            <span className="terminal-muted">{"Welcome to the Firefly shell.\nYour project starts here.\n\n"}</span>
            {"builder@firefly:~ $ "}<span className="terminal-green">pi</span>{" deploy\n\n"}
            <span className="terminal-tree">{"├ "}</span>{"Project  "}<span className="terminal-green">{"personal-site\n"}</span>
            <span className="terminal-tree">{"├ "}</span>{"Source   "}<span className="terminal-green">{"Dockerfile\n"}</span>
            <span className="terminal-tree">{"└ "}</span>{"Target   "}<span className="terminal-green">{"ARM64 + AMD64\n\n"}</span>
            {"Preparing project build...\n"}
            <span className="terminal-progress" aria-label="Example build progress: 25 percent"><span className="terminal-green">{"▮".repeat(6)}</span><span className="terminal-muted">{"▯".repeat(18)}</span></span>
          </code></pre>
        ) : (
          <pre aria-label={example.title}><code>{example.code}</code></pre>
        )}
        <div className="example-note">
          <h3>{example.title}</h3>
          <p>{example.description}</p>
          <span className="caption">Workflow example. Platform in development.</span>
        </div>
      </div>
      <noscript><p>The CLI example is shown above. The blueprint includes the Git and Dockerfile workflows.</p></noscript>
    </div>
  );
}
