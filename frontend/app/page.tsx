import Image from "next/image";
import Workflow from "./workflow";
import HeroArtwork from "./hero-artwork";

const questions = [
  ["Can I deploy something today?", "Firefly is in development and currently intended for my own projects. Public access is planned for people who find it through my portfolio, after the deployment path and operating limits are proven."],
  ["What is it designed to host?", "Static sites, single-container web apps, and small multi-container projects. The design includes projects with their own Postgres or Redis container, with persistent storage on always-on machines."],
  ["Why build a personal PaaS?", "To learn by operating the whole system: a Kubernetes controller in Rust, multi-architecture builds, and machines configured with NixOS. Hosting my own projects gives that learning a practical job."],
  ["Is this for production workloads?", "This is a home-hosted learning project. There is no availability guarantee or public service offering. Keep critical workloads on infrastructure with the support and recovery guarantees they need."],
  ["Will there be paid plans?", "There is no public pricing or billing today. Resource tiers are part of the design, but outside users and billing are later decisions."],
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header frame">
        <a className="wordmark" href="#" aria-label="Firefly home">firefly<span aria-hidden="true">*</span></a>
        <nav aria-label="Main navigation">
          <a href="#workflow">The workflow</a>
          <a href="#hardware">The hardware</a>
          <a href="#about">The why</a>
        </nav>
        <a className="nav-action" href="/blueprint.txt">Read the blueprint <span aria-hidden="true">↗</span></a>
      </header>

      <main id="main">
        <section className="hero frame" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">A home for<br />what you build.</h1>
            <p className="hero-description">A personal PaaS, built to learn and host small projects on hardware I own.</p>
            <a className="button primary" href="#workflow">Explore the build <span aria-hidden="true">↗</span></a>
            <p className="hero-footnote">Built at home. Being built in public.</p>
          </div>
          <HeroArtwork />
        </section>

        <section className="intent frame section-space" aria-labelledby="intent-title">
          <h2 id="intent-title" className="small-heading">Small by intention</h2>
          <div>
            <p className="statement">Some projects just need a place to live. Firefly is my way of building that place, and understanding everything underneath it.</p>
            <p className="intent-detail">Personal projects first. A few curious builders later.</p>
          </div>
        </section>

        <section id="workflow" className="workflow frame section-space" aria-labelledby="workflow-title">
          <div className="section-heading">
            <h2 id="workflow-title">From source<br />to somewhere.</h2>
            <p>The goal is a short path from your project to an HTTPS URL. These are the workflows I am building toward.</p>
          </div>
          <Workflow />
          <ol className="pipeline" aria-label="Planned deployment pipeline">
            <li><strong>Source</strong><p>A push, a Dockerfile, or the pi CLI.</p></li>
            <li><strong>Build</strong><p>BuildKit prepares images for ARM and x86.</p></li>
            <li><strong>Reconcile</strong><p>A Rust operator turns intent into containers.</p></li>
            <li><strong>Serve</strong><p>Traefik routes requests through Cloudflare.</p></li>
          </ol>
        </section>

        <section id="capabilities" className="capabilities frame section-space" aria-labelledby="capabilities-title">
          <h2 id="capabilities-title">The useful parts.</h2>
          <div className="capability-content">
            <div className="capability-copy">
              <p>The plan includes an HTTPS address for every app, isolated project namespaces, and preview environments for pull requests.</p>
              <p>Persistent volumes keep project data on always-on machines. Logs and per-app metrics help explain what is happening.</p>
              <a className="text-link" href="/blueprint.txt">See the deployment design <span aria-hidden="true">↗</span></a>
            </div>
            <figure className="wing-art">
              <Image src="/images/wing.png" alt="An enlarged firefly wing with its delicate structure traced in ASCII characters" width={1536} height={1024} sizes="(max-width: 680px) 100vw, 45vw" />
            </figure>
          </div>
        </section>

        <section id="hardware" className="hardware frame section-space" aria-labelledby="hardware-title">
          <div className="section-heading">
            <h2 id="hardware-title">A cloud with<br />a street address.</h2>
            <p>The proposed cluster fits in a home. The machines have different jobs, based on how reliably they stay on.</p>
          </div>
          <figure className="cluster-photo">
            <Image src="/images/cluster.png" alt="An illustrative home lab with five small computers stacked in open black frames" width={1752} height={897} sizes="100vw" />
            <figcaption>Five Pis. Two desktops. One personal cloud.<span>Hardware study</span></figcaption>
          </figure>
          <dl className="hardware-specs">
            <div><dt>5 × Raspberry Pi 5</dt><dd>8GB each. The always-on foundation.</dd></div>
            <div><dt>2 × desktops</dt><dd>One always on. One lends compute when free.</dd></div>
            <div><dt>ARM64 + AMD64</dt><dd>One platform across two architectures.</dd></div>
          </dl>
        </section>

        <section className="architecture frame section-space" aria-labelledby="architecture-title">
          <div className="architecture-top">
            <h2 id="architecture-title">Nothing hidden<br />under the hood.</h2>
            <p>Each layer has a job. The blueprint records the choices, including the ones that still need to prove themselves.</p>
          </div>
          <dl className="stack-list">
            <div><dt>NixOS</dt><dd>The same declared system, rebuilt on every node.</dd><span>Machines</span></div>
            <div><dt>k3s</dt><dd>A small Kubernetes distribution to schedule the work.</dd><span>Orchestration</span></div>
            <div><dt>Rust + kube-rs</dt><dd>An operator to reconcile the app you asked for.</dd><span>Control</span></div>
            <div><dt>BuildKit + Zot</dt><dd>Build images and keep them inside the network.</dd><span>Delivery</span></div>
            <div><dt>Cloudflare Tunnel</dt><dd>A public route without opening inbound ports at home.</dd><span>Ingress</span></div>
          </dl>
        </section>

        <section id="about" className="about frame section-space" aria-labelledby="about-title">
          <div className="about-panel">
            <Image src="/images/board.png" alt="Illustrative close-up of a single-board computer and its black heatsink on a workbench" width={1448} height={1086} sizes="(max-width: 680px) 100vw, 40vw" />
            <div className="about-letter">
              <h2 id="about-title">Built for the<br />learning part.</h2>
              <p>I wanted a place to host my projects. Building the platform became a project of its own.</p>
              <p>Firefly gives me a reason to work through the uncomfortable parts: deployments, storage, recovery, and keeping a cluster running at home.</p>
              <p>For now, it is personal. Eventually, I want to open the door to people who find it through my portfolio.</p>
              <a className="text-link" href="https://github.com/diamondjdev">Find me on GitHub <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>

        <section id="questions" className="questions frame section-space" aria-labelledby="questions-title">
          <h2 id="questions-title">Fair questions.</h2>
          <div className="faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span className="disclosure-symbol" aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="invitation frame section-space" aria-labelledby="invitation-title">
          <h2 id="invitation-title">Come see<br />how it is built.</h2>
          <div className="invitation-action">
            <p>The architecture, the constraints, and the things still being figured out.</p>
            <a className="button primary" href="/blueprint.txt">Read the blueprint <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>

      <footer className="site-footer frame">
        <div className="footer-meta"><p>Phoenix Firefly</p><a href="#hero-title">Back to top <span aria-hidden="true">↑</span></a></div>
        <p className="footer-wordmark" aria-hidden="true">firefly*</p>
        <div className="footer-meta"><p>A personal cloud. A work in progress.</p><p>Hero map drawn in code. Additional studies created with ImageGen.</p></div>
      </footer>
    </>
  );
}
