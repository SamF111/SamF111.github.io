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
        const release = await fetchLatestRelease(moduleEntry);
        const manifest = await fetchManifestForRelease(moduleEntry, release);
        return renderModuleCard(moduleEntry, release, manifest);
      } catch (error) {
        return renderModuleErrorCard(moduleEntry, error);
      }
    })
  );

  moduleGrid.replaceChildren(...cards);
}

async function fetchLatestRelease(moduleEntry) {
  const repo = getRepoParts(moduleEntry);

  if (!repo.owner || !repo.name) {
    throw new Error("Missing repository owner or name.");
  }

  return fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`);
}

async function fetchManifestForRelease(moduleEntry, release) {
  const repo = getRepoParts(moduleEntry);
  const tagName = release.tag_name;

  if (!tagName) {
    throw new Error("Latest release has no tag.");
  }

  return fetchManifestAtRef(repo.owner, repo.name, tagName);
}

async function fetchManifestAtRef(owner, repoName, ref) {
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/module.json?ref=${encodeURIComponent(ref)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.raw+json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load module.json for ${repoName}@${ref}: HTTP ${response.status}`);
  }

  const text = await response.text();

  try {
    const parsed = JSON.parse(text);

    if (parsed && parsed.encoding === "base64" && parsed.content) {
      return JSON.parse(decodeBase64(parsed.content));
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid module.json for ${repoName}@${ref}: ${error.message}`);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

function renderModuleCard(moduleEntry, release, manifest) {
  const title = manifest.title || moduleEntry.name || moduleEntry.id || release.name || "Unnamed module";
  const description = manifest.description || moduleEntry.description || "Foundry Virtual Tabletop module.";
  const version = manifest.version || release.tag_name || "Unknown";
  const compatibility = formatCompatibility(manifest);
  const status = moduleEntry.status || "stable";
  const repoUrl = moduleEntry.repo || "";
  const manifestUrl = moduleEntry.manifest || "";
  const releaseUrl = release.html_url || `${repoUrl}/releases/latest`;
  const zipAsset = findZipAsset(release.assets || []);
  const zipDownloads = countZipDownloads(release.assets || []);
  const publishedDate = formatDate(release.published_at);
  const downloadUrl = manifest.download || zipAsset?.browser_download_url || releaseUrl;

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
  appendMeta(meta, "Released", publishedDate);
  appendMeta(meta, "ZIP downloads", String(zipDownloads));
  appendMeta(meta, "Status", status, `status status-${status}`);

  const actions = document.createElement("div");
  actions.className = "module-actions";

  actions.appendChild(createLinkButton("Download ZIP", downloadUrl, "button button-primary"));

  if (manifestUrl) {
    actions.appendChild(createCopyButton("Copy Manifest URL", manifestUrl));
  }

  if (repoUrl) {
    actions.appendChild(createLinkButton("GitHub", repoUrl, "button"));
  }

  if (releaseUrl) {
    actions.appendChild(createLinkButton("Release Notes", releaseUrl, "button"));
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
  description.textContent = "This module is listed, but its latest GitHub release or module.json could not be loaded.";

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

function getRepoParts(moduleEntry) {
  if (moduleEntry.owner && moduleEntry.repoName) {
    return {
      owner: moduleEntry.owner,
      name: moduleEntry.repoName
    };
  }

  if (!moduleEntry.repo) {
    return {
      owner: "",
      name: ""
    };
  }

  try {
    const url = new URL(moduleEntry.repo);
    const parts = url.pathname.split("/").filter(Boolean);

    return {
      owner: parts[0] || "",
      name: parts[1] || ""
    };
  } catch {
    return {
      owner: "",
      name: ""
    };
  }
}

function findZipAsset(assets) {
  return assets.find((asset) => asset.name && asset.name.toLowerCase().endsWith(".zip")) || null;
}

function countZipDownloads(assets) {
  return assets
    .filter((asset) => asset.name && asset.name.toLowerCase().endsWith(".zip"))
    .reduce((total, asset) => total + Number(asset.download_count || 0), 0);
}

function formatCompatibility(manifest) {
  const compatibility = manifest.compatibility;

  if (compatibility && typeof compatibility === "object") {
    const minimum = compatibility.minimum || "";
    const verified = compatibility.verified || "";
    const maximum = compatibility.maximum || "";

    if (minimum && verified && maximum) {
      return `Foundry VTT v${minimum}–v${maximum}, verified v${verified}`;
    }

    if (minimum && verified) {
      return `Foundry VTT v${minimum}+, verified v${verified}`;
    }

    if (verified) {
      return `Foundry VTT verified v${verified}`;
    }

    if (minimum) {
      return `Foundry VTT v${minimum}+`;
    }
  }

  const minimumCore = manifest.minimumCoreVersion || "";
  const compatibleCore = manifest.compatibleCoreVersion || "";

  if (minimumCore && compatibleCore) {
    return `Foundry VTT v${minimumCore}+, compatible v${compatibleCore}`;
  }

  if (compatibleCore) {
    return `Foundry VTT compatible v${compatibleCore}`;
  }

  if (minimumCore) {
    return `Foundry VTT v${minimumCore}+`;
  }

  return "Unknown";
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function renderFatalError(error) {
  moduleGrid.replaceChildren(
    createCardShell("Hub failed to load", error.message)
  );
}
