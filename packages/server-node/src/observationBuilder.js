import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATTERN_NAMES = ["login", "payment"];

/**
 * Build CPMS observation from HTML and optional screenshot.
 * Extracts form candidates from HTML and optional app/accessibility snapshots.
 */
export function buildObservationFromHtml(html = "", screenshotPath = null, url = null, domSnapshot = null) {
  const htmlCandidates = extractCandidates(html ?? "");
  const snapshotCandidates = extractCandidatesFromDomSnapshot(domSnapshot, htmlCandidates.length);

  const observation = {
    page_id: url || `page:${Date.now()}`,
    candidates: [...htmlCandidates, ...snapshotCandidates]
  };

  if (screenshotPath) {
    try {
      const screenshotData = fs.readFileSync(screenshotPath, "base64");
      observation.screenshot = screenshotData;
      observation.screenshot_format = "base64";
    } catch (err) {
      // If file read fails, just pass the path.
      observation.screenshot_path = screenshotPath;
    }
  }

  if (domSnapshot) {
    observation.dom_snapshot = domSnapshot;
  }

  return observation;
}

/**
 * Build CPMS observation from a static mobile/Appium-style tree.
 * This is a contract helper only; it does not require an emulator or Appium runtime.
 */
export function buildObservationFromMobileTree(tree = {}, url = null) {
  const nodes = [];
  walkMobileTree(tree, nodes);
  return {
    page_id: url || tree.page_id || tree.id || `mobile:${Date.now()}`,
    source: "mobile_tree",
    candidates: nodes.map(normalizeMobileCandidate)
  };
}

/**
 * Extract candidate elements from HTML.
 * Returns array of candidate objects with DOM attributes.
 */
function extractCandidates(html) {
  const candidates = [];
  if (!html || !html.trim()) return candidates;

  const $ = cheerio.load(html, { xmlMode: false });
  $("input, textarea, select, button, [role='button'], [role='textbox'], [role='combobox']").each((index, element) => {
    const attrs = extractAttributes(element);
    const tagName = element.tagName?.toLowerCase() ?? "";
    const text = normalizeText($(element).text());
    const labelText = findLabelText($, element, attrs, text);
    const role = inferRole(tagName, attrs);
    const type = attrs.type || inferType(tagName, attrs);

    candidates.push({
      candidate_id: `cand_${index}`,
      dom: {
        attrs,
        tag: tagName,
        type,
        role,
        label_text: labelText,
        placeholder: attrs.placeholder || null,
        aria_label: attrs["aria-label"] || null,
        text: text || null,
        nearby_text: collectNearbyText($, element, labelText)
      }
    });
  });

  return candidates;
}

/**
 * Extract attributes from a Cheerio element, preserving hyphenated names.
 */
function extractAttributes(element) {
  const attrs = {};
  for (const [name, value] of Object.entries(element.attribs ?? {})) {
    attrs[name.toLowerCase()] = value === "" ? true : value;
  }

  return attrs;
}

function findLabelText($, element, attrs, elementText) {
  if (attrs.id) {
    const explicit = normalizeText($(`label[for="${escapeCssString(attrs.id)}"]`).first().text());
    if (explicit) return explicit;
  }

  const wrapping = normalizeText($(element).closest("label").text());
  if (wrapping) return wrapping;

  const labelledBy = attrs["aria-labelledby"];
  if (labelledBy) {
    const labelledText = labelledBy
      .split(/\s+/)
      .map((id) => normalizeText($(`#${escapeCssIdent(id)}`).text()))
      .filter(Boolean)
      .join(" ");
    if (labelledText) return labelledText;
  }

  return (
    elementText ||
    attrs["aria-label"] ||
    attrs.placeholder ||
    attrs.title ||
    attrs.value ||
    null
  );
}

function collectNearbyText($, element, labelText) {
  const pieces = [
    labelText,
    normalizeText($(element).prev("label").text()),
    normalizeText($(element).parent().find("label").first().text())
  ].filter(Boolean);
  return [...new Set(pieces)];
}

function inferRole(tagName, attrs) {
  if (attrs.role) return String(attrs.role).toLowerCase();
  if (tagName === "button") return "button";
  if (tagName === "select") return "combobox";
  if (tagName === "textarea") return "textbox";
  if (tagName === "input" && ["button", "submit", "reset"].includes(String(attrs.type ?? "").toLowerCase())) {
    return "button";
  }
  if (tagName === "input") return "textbox";
  return null;
}

function inferType(tagName, attrs) {
  if (attrs.type) return attrs.type;
  if (tagName === "textarea") return "textarea";
  if (tagName === "select") return "select";
  if (tagName === "button") return "button";
  if (tagName === "input") return "text";
  return tagName || null;
}

function extractCandidatesFromDomSnapshot(domSnapshot, offset = 0) {
  if (!domSnapshot) return [];
  if (Array.isArray(domSnapshot)) {
    return domSnapshot.map((candidate, index) => normalizeSnapshotCandidate(candidate, offset + index));
  }
  if (Array.isArray(domSnapshot?.candidates)) {
    return domSnapshot.candidates.map((candidate, index) => normalizeSnapshotCandidate(candidate, offset + index));
  }

  const nodes = [];
  walkSnapshot(domSnapshot, nodes);
  return nodes.map((node, index) => normalizeSnapshotCandidate(node, offset + index));
}

function walkSnapshot(node, candidates) {
  if (!node || typeof node !== "object") return;

  const attrs = node.attrs ?? node.attributes ?? {};
  const role = String(node.role ?? attrs.role ?? "").toLowerCase();
  const tagName = String(node.tag ?? node.tagName ?? node.nodeName ?? "").toLowerCase();
  const type = String(node.type ?? attrs.type ?? "").toLowerCase();
  const hasFormRole = ["textbox", "button", "combobox", "checkbox", "radio", "searchbox"].includes(role);
  const hasFormTag = ["input", "textarea", "select", "button"].includes(tagName);
  const hasFormType = Boolean(type && ["email", "password", "text", "tel", "number", "submit", "button"].includes(type));

  if (hasFormRole || hasFormTag || hasFormType) {
    candidates.push(node);
  }

  for (const child of node.children ?? node.nodes ?? []) {
    walkSnapshot(child, candidates);
  }
}

function normalizeSnapshotCandidate(node, index) {
  const attrs = lowerCaseKeys(node.dom?.attrs ?? node.attrs ?? node.attributes ?? {});
  const tag = node.dom?.tag ?? node.tag ?? node.tagName ?? null;
  const role = String(node.dom?.role ?? node.role ?? attrs.role ?? inferRole(String(tag ?? "").toLowerCase(), attrs) ?? "").toLowerCase() || null;
  const labelText = node.dom?.label_text ?? node.label_text ?? node.name ?? node.text ?? attrs["aria-label"] ?? attrs.placeholder ?? null;
  return {
    candidate_id: node.candidate_id ?? `cand_${index}`,
    dom: {
      attrs,
      tag,
      type: node.dom?.type ?? node.type ?? attrs.type ?? null,
      role,
      label_text: normalizeText(labelText),
      placeholder: node.dom?.placeholder ?? node.placeholder ?? attrs.placeholder ?? null,
      aria_label: node.dom?.aria_label ?? node.aria_label ?? attrs["aria-label"] ?? null,
      text: normalizeText(node.dom?.text ?? node.text ?? null),
      nearby_text: normalizeNearbyText(node.dom?.nearby_text ?? node.nearby_text ?? node.name)
    },
    vision: node.vision
  };
}

function walkMobileTree(node, candidates) {
  if (!node || typeof node !== "object") return;

  const resourceId = node.resource_id ?? node.resourceId ?? node["resource-id"];
  const className = node.class ?? node.className;
  const contentDesc = node.content_desc ?? node.contentDescription ?? node["content-desc"];
  const text = node.text ?? node.label ?? node.name;
  const clickable = Boolean(node.clickable);
  const enabled = node.enabled !== false;
  const inputType = node.input_type ?? node.inputType;
  const focusable = Boolean(node.focusable ?? node.focused);

  const isCandidate = Boolean(
    resourceId ||
    contentDesc ||
    inputType ||
    clickable ||
    focusable ||
    text ||
    String(className ?? "").match(/(EditText|Button|CheckBox|RadioButton|Spinner|TextInput)/i)
  );

  if (isCandidate) candidates.push(node);

  for (const child of node.children ?? node.nodes ?? []) {
    walkMobileTree(child, candidates);
  }
}

function normalizeMobileCandidate(node, index) {
  const resourceId = node.resource_id ?? node.resourceId ?? node["resource-id"] ?? null;
  const className = node.class ?? node.className ?? null;
  const contentDesc = node.content_desc ?? node.contentDescription ?? node["content-desc"] ?? null;
  const text = normalizeText(node.text ?? node.label ?? node.name ?? null);
  const inputType = node.input_type ?? node.inputType ?? null;
  return {
    candidate_id: node.candidate_id ?? `mobile_${index}`,
    mobile: {
      resource_id: resourceId,
      class: className,
      content_desc: contentDesc,
      text,
      bounds: node.bounds ?? null,
      clickable: Boolean(node.clickable),
      enabled: node.enabled !== false,
      focused: Boolean(node.focused),
      input_type: inputType
    },
    a11y: {
      name: contentDesc ?? text ?? null,
      role: inferMobileRole(className, inputType, node.clickable)
    }
  };
}

function inferMobileRole(className, inputType, clickable) {
  const source = `${className ?? ""} ${inputType ?? ""}`.toLowerCase();
  if (source.includes("edittext") || inputType) return "textbox";
  if (source.includes("button") || clickable) return "button";
  if (source.includes("checkbox")) return "checkbox";
  if (source.includes("radio")) return "radio";
  if (source.includes("spinner")) return "combobox";
  return null;
}

function lowerCaseKeys(value) {
  return Object.fromEntries(Object.entries(value ?? {}).map(([key, val]) => [key.toLowerCase(), val]));
}

function normalizeNearbyText(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  const normalized = normalizeText(value);
  return normalized ? [normalized] : [];
}

function normalizeText(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(" ");
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeCssIdent(value) {
  return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function escapeCssString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function loadPattern(patternName) {
  const examplesDir = path.join(__dirname, "../../../examples");
  const patternPath = path.join(examplesDir, `patterns/${patternName}.pattern.json`);
  const pattern = JSON.parse(fs.readFileSync(patternPath, "utf-8"));
  const concepts = pattern.includes.map((conceptId) => {
    const filename = conceptIdToExampleFilename(conceptId);
    const conceptPath = path.join(examplesDir, `concepts/${filename}.json`);
    return JSON.parse(fs.readFileSync(conceptPath, "utf-8"));
  });

  return { pattern, concepts };
}

function conceptIdToExampleFilename(conceptId) {
  return conceptId
    .replace(/^concept:/, "")
    .replace(/@\d+\.\d+\.\d+$/, "")
    .replace("submit_login", "login.submit")
    .replace("submit_payment", "payment.submit")
    .replace("card_expiry", "payment.expiry")
    .replace("card_cvv", "payment.cvv")
    .replace(/^card_/, "payment.card_")
    .replace("email", "login.email")
    .replace("password", "login.password");
}

/**
 * Load default login pattern and concepts from examples directory.
 */
export function loadDefaultLoginPattern() {
  return loadPattern("login");
}

/**
 * Load built-in form patterns used by high-level detection.
 */
export function loadDefaultPatterns() {
  return DEFAULT_PATTERN_NAMES.map(loadPattern);
}
