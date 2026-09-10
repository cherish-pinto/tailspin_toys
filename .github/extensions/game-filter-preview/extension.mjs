// Extension: game-filter-preview
// Interactive preview of the game's category and publisher filtering behavior.
//
import { createServer } from "node:http";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const servers = new Map();
const games = [
    { title: "Cloud Conqueror", category: "Action", publisher: "CodeForge Studios" },
    { title: "Code Puzzle Chronicles", category: "Puzzle", publisher: "CodeForge Studios" },
    { title: "Container Chaos", category: "Simulation", publisher: "DevMasters Inc." },
    { title: "DevOps Dominion", category: "Strategy", publisher: "CodeForge Studios" },
    { title: "Merge Conflict Mystery", category: "Puzzle", publisher: "DevMasters Inc." },
    { title: "Server Siege", category: "Strategy", publisher: "GitHub Games" },
];
const categories = [...new Set(games.map((game) => game.category))].sort();
const publishers = [...new Set(games.map((game) => game.publisher))].sort();

function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderHtml() {
    const categoryOptions = categories.map((category) => `
      <label class="check">
        <input type="checkbox" value="${escapeHtml(category)}" data-category />
        <span>${escapeHtml(category)}</span>
      </label>`).join("");
    const publisherOptions = publishers.map((publisher) => `
      <option value="${escapeHtml(publisher)}">${escapeHtml(publisher)}</option>`).join("");
    const gameCards = games.map((game) => `
      <article class="card" data-category="${escapeHtml(game.category)}" data-publisher="${escapeHtml(game.publisher)}">
        <h2>${escapeHtml(game.title)}</h2>
        <p>${escapeHtml(game.category)} · ${escapeHtml(game.publisher)}</p>
      </article>`).join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Game filter preview</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; padding: 24px; background: var(--background-color-default, #0d1117); color: var(--text-color-default, #f0f6fc); font: 14px/1.5 var(--font-sans, system-ui, sans-serif); }
      main { max-width: 900px; margin: auto; }
      .toolbar { display: flex; gap: 20px; flex-wrap: wrap; align-items: end; padding: 16px; border: 1px solid var(--border-color-default, #30363d); border-radius: 10px; }
      fieldset { border: 0; padding: 0; margin: 0; }
      legend, label { font-weight: 600; }
      .checks { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
      .check { display: flex; gap: 6px; align-items: center; font-weight: 400; }
      select, button { padding: 8px 10px; border: 1px solid var(--border-color-default, #30363d); border-radius: 6px; background: #161b22; color: inherit; }
      button { cursor: pointer; font-weight: 600; }
      :focus-visible { outline: 2px solid var(--color-focus-outline, #4493f8); outline-offset: 2px; }
      .status { color: var(--text-color-muted, #8b949e); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
      .card { padding: 16px; border: 1px solid var(--border-color-default, #30363d); border-radius: 8px; background: #161b22; }
      .card h2 { font-size: 16px; margin: 0 0 6px; }
      .card p { margin: 0; color: var(--text-color-muted, #8b949e); }
      [hidden] { display: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Game catalog filter preview</h1>
      <p>Category filters use OR semantics. Publisher filtering combines with categories using AND semantics.</p>
      <section class="toolbar" aria-label="Game filters">
        <fieldset>
          <legend>Categories</legend>
          <div class="checks">${categoryOptions}</div>
        </fieldset>
        <label>Publisher
          <select data-publisher aria-label="Publisher">
            <option value="">All publishers</option>${publisherOptions}
          </select>
        </label>
        <button type="button" data-reset>Clear filters</button>
      </section>
      <p class="status" data-status aria-live="polite"></p>
      <section class="grid" aria-label="Games">${gameCards}</section>
    </main>
    <script>
      const categories = [...document.querySelectorAll("[data-category]")];
      const publisher = document.querySelector("[data-publisher]");
      const cards = [...document.querySelectorAll(".card")];
      const status = document.querySelector("[data-status]");
      const update = () => {
        const selected = new Set(categories.filter((input) => input.checked).map((input) => input.value));
        const publisherValue = publisher.value;
        let visible = 0;
        cards.forEach((card) => {
          const matchesCategory = selected.size === 0 || selected.has(card.dataset.category);
          const matchesPublisher = !publisherValue || publisherValue === card.dataset.publisher;
          card.hidden = !(matchesCategory && matchesPublisher);
          if (!card.hidden) visible += 1;
        });
        status.textContent = "Showing " + visible + " " + (visible === 1 ? "game" : "games");
      };
      categories.forEach((input) => input.addEventListener("change", update));
      publisher.addEventListener("change", update);
      document.querySelector("[data-reset]").addEventListener("click", () => {
        categories.forEach((input) => { input.checked = false; });
        publisher.value = "";
        update();
      });
      update();
    </script>
  </body>
</html>`;
}

async function startServer(instanceId) {
    const server = createServer((req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderHtml());
    });
    // Port 0 = let the OS pick a free ephemeral port. Bind to loopback only.
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "game-filter-preview",
            displayName: "Game filter preview",
            description: "Preview category and publisher filtering with accessible interactive controls.",
            actions: [
                {
                    name: "get_filter_summary",
                    description: "Return the sample catalog and the filtering semantics shown in the preview.",
                    handler: async () => {
                        return {
                            gameCount: games.length,
                            categories,
                            publishers,
                            categorySemantics: "OR",
                            combinedSemantics: "AND",
                        };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: "Game filter preview",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
