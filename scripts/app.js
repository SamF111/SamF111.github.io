const MODULES_JSON_URL = "modules.json";

const moduleGrid = document.getElementById("module-grid");

main().catch((error) => {
  renderFatalError(error);
});

async function main() {
  const modules = await fetchJson(MODULES_JSON_URL);

  if (!Array.isArray(modules) || modules.length === 0) {
    moduleGrid.replaceChildren(
      createCardShell("No modules configured", "Add module entries to modules.json.")
    );
    return;
  }

  const cards = await Promise.all(
    modules.map(async (moduleEntry) => {
      try {
        const manifest = await fetchJson(moduleEntry.manifest);
        return renderModuleCard(moduleEntry, manifest);
      } catch (error) {
        return renderModuleErrorCard(moduleEntry, error);
      }
    })
  );

  moduleGrid.replaceChildren(...cards);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

function renderModuleCard(moduleEntry, manifest) {
  const title = manifest.title || moduleEntry.name || moduleEntry.id;
  const description = manifest.description || moduleEntry.description || "No description provided.";
  const version = manifest.version || "Unknown";
  const compatibility = formatCompatibility(manifest.compatibility);
  const manifestUrl = moduleEntry.manifest;
  const downloadUrl = manifest.download || moduleEntry.download || "";
  const repoUrl = moduleEntry.repo || manifest.url || "";
  const status = moduleEntry.status || "stable";

  const card = document.createElement("article");
  card.className = "module-card";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const descriptionElement = document.createElement("p");
  descriptionElement.className = "module-description";
  descriptionElement.textContent = description;

  const meta = document.createElement("dl");
  meta.className = "module-meta";

  appendMeta(meta, "Version", version);
  appendMeta(meta, "Compatibility", compatibility);
  appendMeta(meta, "Status", status, `status status-${status}`);

  const actions = document.createElement("div");
  actions.className = "module-actions";

  if (downloadUrl) {
    actions.appendChild(createLinkButton("Download ZIP", downloadUrl, "button button-primary"));
  }

  actions.appendChild(createCopyButton("Copy Manifest URL", manifestUrl));

  if (repoUrl) {
    actions.appendChild(createLinkButton("GitHub", repoUrl, "button"));
  }

  card.append(heading, descriptionElement, meta, actions);

  return card;
}

function renderModuleErrorCard(moduleEntry, error) {
  const title = moduleEntry.name || moduleEntry.id || "Unknown module";

  const card = document.createElement("article");
  card.className = "module-card error-card";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const description = document.createElement("p");
  description.className = "module-description";
  description.textContent = "This module is listed, but its manifest could not be loaded.";

  const message = document.createElement("p");
  message.className = "error-message";
  message.textContent = error.message;

  const actions = document.createElement("div");
  actions.className = "module-actions";

  if (moduleEntry.manifest) {
    actions.appendChild(createCopyButton("Copy Manifest URL", moduleEntry.manifest));
  }

  if (moduleEntry.repo) {
    actions.appendChild(createLinkButton("GitHub", moduleEntry.repo, "button"));
  }

  card.append(heading, description, message, actions);

  return card;
}

function createCardShell(title, body) {
  const card = document.createElement("article");
  card.className = "loading-card";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = body;

  card.append(heading, paragraph);

  return card;
}

function appendMeta(parent, label, value, valueClassName = "") {
  const wrapper = document.createElement("div");

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");

  if (valueClassName) {
    const span = document.createElement("span");
    span.className = valueClassName;
    span.textContent = value;
    description.appendChild(span);
  } else {
    description.textContent = value;
  }

  wrapper.append(term, description);
  parent.appendChild(wrapper);
}

function createLinkButton(label, href, className) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  link.rel = "noopener noreferrer";

  return link;
}

function createCopyButton(label, value) {
  const button = document.createElement("button");
  button.className = "button";
  button.type = "button";
  button.textContent = label;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = label;
      }, 1400);
    } catch {
      button.textContent = "Copy failed";
      window.setTimeout(() => {
        button.textContent = label;
      }, 1400);
    }
  });

  return button;
}

function formatCompatibility(compatibility) {
  if (!compatibility || typeof compatibility !== "object") {
    return "Unknown";
  }

  const minimum = compatibility.minimum || "";
  const verified = compatibility.verified || "";
  const maximum = compatibility.maximum || "";

  if (minimum && verified && maximum) {
    return `${minimum}–${maximum}, verified ${verified}`;
  }

  if (minimum && verified) {
    return `${minimum}+, verified ${verified}`;
  }

  if (verified) {
    return `Verified ${verified}`;
  }

  if (minimum) {
    return `${minimum}+`;
  }

  return "Unknown";
}

function renderFatalError(error) {
  moduleGrid.replaceChildren(
    createCardShell("Hub failed to load", error.message)
  );
}
