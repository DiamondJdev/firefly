import Workflow from "./workflow";
import HeroArtwork from "./hero-artwork";
import IntentCapacity from "./intent-capacity";
import { AboutRoute, CapabilityJunction, ExplodedStack, InvitationRoute, KerbRoad, Pipeline, RampedQuestions } from "./road-scenes";

const questions = [
  ["Can I deploy something today?", "Firefly is in development and currently intended for my own projects. Public access is planned for people who find it through my portfolio, after the deployment path and operating limits are proven."],
  ["What is it designed to host?", "Static sites, single-container web apps, and small multi-container projects. The design includes projects with their own Postgres or Redis container, with persistent storage on always-on machines."],
  ["Why build a personal PaaS?", "To learn by operating the whole system: a Kubernetes controller in Rust, multi-architecture builds, and machines configured with NixOS. Hosting my own projects gives that learning a practical job."],
  ["Is this for production workloads?", "This is a home-hosted learning project. There is no availability guarantee or public service offering. Keep critical workloads on infrastructure with the support and recovery guarantees they need."],
  ["Will there be paid plans?", "There is no public pricing or billing today. Resource tiers are part of the design, but outside users and billing are later decisions."],
];

const stages: [string, string][] = [
  ["Source", "A push, a Dockerfile, or the pi CLI."],
  ["Build", "BuildKit prepares images for ARM and x86."],
  ["Reconcile", "A Rust operator turns intent into containers."],
  ["Serve", "Traefik routes requests through Cloudflare."],
];

const layers: [string, string, string][] = [
  ["NixOS", "The same declared system, rebuilt on every node.", "Machines"],
  ["k3s", "A small Kubernetes distribution to schedule the work.", "Orchestration"],
  ["Rust + kube-rs", "An operator to reconcile the app you asked for.", "Control"],
  ["BuildKit + Zot", "Build images and keep them inside the network.", "Delivery"],
  ["Cloudflare Tunnel", "A public route without opening inbound ports at home.", "Ingress"],
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header frame">
        <a className="wordmark" href="#" aria-label="Firefly home">firefly<span aria-hidden="true">*</span></a>
        <nav aria-label="Main navigation">
          <a href="#workflow">The workflow</a>
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
            <p className="hero-footnote">Invite only access for now</p>
          </div>
          <HeroArtwork />
        </section>

        <section className="intent frame section-space" aria-labelledby="intent-title">
          <div className="intent-copy">
            <h2 id="intent-title">Small by<br />intention.</h2>
            <p className="statement">Some projects just need a place to live. Firefly is my way of building that place, and understanding everything underneath it.</p>
          </div>
          <IntentCapacity />
        </section>

        <section id="workflow" className="workflow frame section-space" aria-labelledby="workflow-title">
          <div className="section-heading">
            <h2 id="workflow-title">From source<br />to somewhere.</h2>
            <p>The goal is a short path from your project to an HTTPS URL. These are the workflows I am building toward.</p>
          </div>
          <Workflow />
          <Pipeline stages={stages} />
        </section>

        <section id="capabilities" className="capabilities frame section-space" aria-labelledby="capabilities-title">
          <h2 id="capabilities-title">The useful parts.</h2>
          <CapabilityJunction>
            <div className="capability-copy">
              <p>The plan includes an HTTPS address for every app, isolated project namespaces, and preview environments for pull requests.</p>
              <p>Persistent volumes keep project data on always-on machines. Logs and per-app metrics help explain what is happening.</p>
              <a className="text-link" href="/blueprint.txt">See the deployment design <span aria-hidden="true">↗</span></a>
            </div>
          </CapabilityJunction>
        </section>

        <section className="architecture frame section-space" aria-labelledby="architecture-title">
          <div className="architecture-top">
            <h2 id="architecture-title">Nothing hidden<br />under the hood.</h2>
            <p>Each layer has a job. The blueprint records the choices, including the ones that still need to prove themselves.</p>
          </div>
          <ExplodedStack layers={layers} />
        </section>

        <section id="about" className="about frame section-space" aria-labelledby="about-title">
          <div className="about-panel">
            <AboutRoute />
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
          <RampedQuestions questions={questions} />
        </section>

        <section className="invitation frame section-space" aria-labelledby="invitation-title">
          <InvitationRoute />
          <h2 id="invitation-title">Come see<br />how it is built.</h2>
          <div className="invitation-action">
            <p>The architecture, the constraints, and the things still being figured out.</p>
            <a className="button primary" href="/blueprint.txt" data-destination>Read the blueprint <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>

      <footer className="site-footer frame">
        <div className="footer-meta"><p>Phoenix Firefly</p><a href="#hero-title">Back to top <span aria-hidden="true">↑</span></a></div>
        <p className="footer-wordmark" aria-hidden="true">firefly*</p>
        <KerbRoad />
        <div className="footer-meta"><p>A personal cloud. A work in progress.</p><p>Every map and diagram is drawn in code.</p></div>
      </footer>
    </>
  );
}
