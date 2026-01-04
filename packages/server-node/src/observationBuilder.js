import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build CPMS observation from HTML and optional screenshot.
 * Extracts form candidates (inputs, buttons) from HTML.
 */
export function buildObservationFromHtml(html, screenshotPath = null, url = null, domSnapshot = null) {
  const candidates = extractCandidates(html);
  
  const observation = {
    page_id: url || `page:${Date.now()}`,
    candidates
  };
  
  if (screenshotPath) {
    try {
      const screenshotData = fs.readFileSync(screenshotPath, "base64");
      observation.screenshot = screenshotData;
      observation.screenshot_format = "base64";
    } catch (err) {
      // If file read fails, just pass the path
      observation.screenshot_path = screenshotPath;
    }
  }
  
  if (domSnapshot) {
    observation.dom_snapshot = domSnapshot;
  }
  
  return observation;
}

/**
 * Extract candidate elements from HTML.
 * Returns array of candidate objects with DOM attributes.
 */
function extractCandidates(html) {
  const candidates = [];
  let candidateId = 0;
  
  // Simple regex-based extraction (can be enhanced with proper HTML parser)
  // Match input elements
  const inputRegex = /<input[^>]*>/gi;
  let match;
  
  while ((match = inputRegex.exec(html)) !== null) {
    const inputHtml = match[0];
    const attrs = extractAttributes(inputHtml);
    const candidate = {
      candidate_id: `cand_${candidateId++}`,
      dom: {
        attrs: attrs,
        label_text: extractLabelText(html, match.index),
        placeholder: attrs.placeholder || null
      }
    };
    candidates.push(candidate);
  }
  
  // Match button elements
  const buttonRegex = /<button[^>]*>([^<]*)<\/button>/gi;
  while ((match = buttonRegex.exec(html)) !== null) {
    const buttonHtml = match[0];
    const buttonText = match[1] || "";
    const attrs = extractAttributes(buttonHtml);
    const candidate = {
      candidate_id: `cand_${candidateId++}`,
      dom: {
        role: "button",
        attrs: attrs,
        label_text: buttonText.trim() || attrs["aria-label"] || null
      }
    };
    candidates.push(candidate);
  }
  
  return candidates;
}

/**
 * Extract attributes from HTML tag string.
 */
function extractAttributes(tagHtml) {
  const attrs = {};
  const attrRegex = /(\w+)(?:=["']([^"']*)["'])?/g;
  let match;
  
  while ((match = attrRegex.exec(tagHtml)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] || true;
    attrs[name] = value;
  }
  
  return attrs;
}

/**
 * Extract label text associated with an input element.
 * Looks for <label> tags with matching for/id attributes.
 */
function extractLabelText(html, inputIndex) {
  // Simple heuristic: look for label before the input
  const beforeInput = html.substring(Math.max(0, inputIndex - 500), inputIndex);
  const labelMatch = beforeInput.match(/<label[^>]*>([^<]*)<\/label>/i);
  if (labelMatch) {
    return labelMatch[1].trim();
  }
  return null;
}

/**
 * Load default login pattern and concepts from examples directory.
 */
export function loadDefaultLoginPattern() {
  const examplesDir = path.join(__dirname, "../../../examples");
  
  const patternPath = path.join(examplesDir, "patterns/login.pattern.json");
  const emailConceptPath = path.join(examplesDir, "concepts/login.email.json");
  const passwordConceptPath = path.join(examplesDir, "concepts/login.password.json");
  const submitConceptPath = path.join(examplesDir, "concepts/login.submit.json");
  
  const pattern = JSON.parse(fs.readFileSync(patternPath, "utf-8"));
  const emailConcept = JSON.parse(fs.readFileSync(emailConceptPath, "utf-8"));
  const passwordConcept = JSON.parse(fs.readFileSync(passwordConceptPath, "utf-8"));
  const submitConcept = JSON.parse(fs.readFileSync(submitConceptPath, "utf-8"));
  
  return {
    pattern,
    concepts: [emailConcept, passwordConcept, submitConcept]
  };
}

