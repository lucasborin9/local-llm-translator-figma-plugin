const defaultHeight = 165 + 152;
figma.showUI(__html__, {
  themeColors: true,
  width: 300,
  height: defaultHeight,
});
let viewportHeight, translationState, isOtherLang, isOtherModel;

// Load every distinct font used by selected TEXT or STICKY nodes
async function loadAllFonts(nodes) {
  const fontMap = new Map();
  for (const node of nodes) {
    // Load primary fontName or sticky text.fontName
    let fn = null;
    if (node.type === 'TEXT') fn = node.fontName;
    else if (
      node.type === 'STICKY' ||
      node.type === 'SHAPE_WITH_TEXT' ||
      node.type === 'TABLE_CELL'
    )
      fn = node.text.fontName;
    if (fn && typeof fn === 'object') {
      const key = `${fn.family}::${fn.style}`;
      fontMap.set(key, fn);
    }
    // Also extract and load all run fonts (handles mixed styles)
    const { runs } = extractRuns(node);
    for (const run of runs) {
      const rfn = run.fontName;
      if (rfn && typeof rfn === 'object') {
        const key2 = `${rfn.family}::${rfn.style}`;
        fontMap.set(key2, rfn);
      }
    }
  }
  await Promise.all(
    Array.from(fontMap.values()).map((font) => figma.loadFontAsync(font))
  );
}

function extractRuns(node) {
  const content =
    node.type === 'TEXT' ||
    node.type === 'TABLE_CELL' ||
    node.type === 'TextSublayer'
      ? node.characters
      : node.text.characters;

  const runs = [];
  let idx = 0;

  while (idx < content.length) {
    const fontName =
      node.type === 'TEXT'
        ? node.getRangeFontName(idx, idx + 1)
        : node.text.getRangeFontName(idx, idx + 1);

    const start = idx;
    idx++;

    while (
      idx < content.length &&
      JSON.stringify(
        node.type === 'TEXT'
          ? node.getRangeFontName(idx, idx + 1)
          : node.text.getRangeFontName(idx, idx + 1)
      ) === JSON.stringify(fontName)
    ) {
      idx++;
    }

    runs.push({ start, end: idx, fontName });
  }

  return { content, runs };
}

// Build prompt preserving bold via ** markers
function buildPrompt(content, runs, lang) {
  let promptText = '';
  let last = 0;
  for (const run of runs) {
    promptText += content.substring(last, run.start);
    const segment = content.substring(run.start, run.end);
    if (run.fontName.style.toLowerCase().includes('bold')) {
      promptText += `**${segment}**`;
    } else {
      promptText += segment;
    }
    last = run.end;
  }
  promptText += content.substring(last);
  return `Translate this to ${lang}, preserving **bold** markup. ONLY return the translated text with ** markers intact:\n\n${promptText}`;
}

// Parse AI output, reconstruct clean text and bold run indices
function parseTranslated(output) {
  const boldRegex = /\*\*(.*?)\*\*/gs;
  let clean = '';
  const boldRuns = [];
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(output)) !== null) {
    const boldStart = match.index;
    const boldEnd = boldRegex.lastIndex;

    // Add any text before this bold segment
    const before = output.slice(lastIndex, boldStart);
    clean += before;

    // Add bold text and track indices
    const boldText = match[1];
    const start = clean.length;
    clean += boldText;
    const end = clean.length;
    boldRuns.push({ start, end });

    lastIndex = boldEnd;
  }

  // Add any remaining text after last bold segment
  clean += output.slice(lastIndex);

  return { clean, boldRuns };
}

// Apply translated text and re-apply bold formatting
async function applyRuns(node, cleanText, boldRuns, originalRuns) {
  // Determine a default font to set full text
  let defaultFont = node.type === 'TEXT' ? node.fontName : node.text.fontName;
  if (!defaultFont || typeof defaultFont === 'string') {
    // fallback to first original run
    defaultFont = originalRuns[0].fontName;
  }
  if (defaultFont && typeof defaultFont === 'object') {
    await figma.loadFontAsync(defaultFont);
  }
  // Set full translated text
  if (node.type === 'TEXT') node.characters = cleanText;
  else node.text.characters = cleanText;

  // Re-apply bold runs
  for (const run of boldRuns) {
    const baseFont =
      node.type === 'TEXT'
        ? node.getRangeFontName(run.start, run.start + 1)
        : node.text.getRangeFontName(run.start, run.start + 1);
    const boldFont = { family: baseFont.family, style: 'Bold' };
    await figma.loadFontAsync(boldFont);
    if (node.type === 'TEXT') {
      node.setRangeFontName(run.start, run.end, boldFont);
    } else {
      node.text.setRangeFontName(run.start, run.end, boldFont);
    }
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg === 'otherModel') {
    isOtherModel = true;
    if (isOtherLang == true) {
      viewportHeight = defaultHeight + 78;
      figma.ui.resize(300, viewportHeight);
      return;
    }
    viewportHeight = defaultHeight + 39;
    figma.ui.resize(300, viewportHeight);
    return;
  }

  if (msg === 'otherLang') {
    isOtherLang = true;
    if (isOtherModel == true) {
      viewportHeight = defaultHeight + 78;
      figma.ui.resize(300, viewportHeight);
      return;
    }
    viewportHeight = defaultHeight + 39;
    figma.ui.resize(300, viewportHeight);
    return;
  }

  if (msg === 'defaultLang') {
    isOtherLang = false;
    if (isOtherModel == true) {
      viewportHeight = defaultHeight + 39;
      figma.ui.resize(300, viewportHeight);
      return;
    }
    viewportHeight = defaultHeight;
    figma.ui.resize(300, viewportHeight);
    return;
  }

  if (msg === 'defaultModel') {
    isOtherModel = false;
    if (isOtherLang == true) {
      viewportHeight = defaultHeight + 39;
      figma.ui.resize(300, viewportHeight);
      return;
    }
    viewportHeight = defaultHeight;
    figma.ui.resize(300, viewportHeight);
    return;
  }

  if (msg.type !== 'translate') return;

  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify(
      'Select at least one text, sticky note or shapes with text inside.'
    );
    return;
  }

  const nodes = selection.filter(
    (n) =>
      n.type === 'TEXT' ||
      n.type === 'STICKY' ||
      n.type === 'SHAPE_WITH_TEXT' ||
      n.type === 'TABLE_CELL'
  );
  await loadAllFonts(nodes);

  for (const node of nodes) {
    const { content, runs } = extractRuns(node);
    const prompt = buildPrompt(content, runs, msg.lang);

    try {
      const response = await fetch(
        `http://localhost:${msg.port}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer lmstudio',
          },
          body: JSON.stringify({
            model: msg.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        }
      );
      const data = await response.json();
      let aiText = '';
      if (
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        aiText = data.choices[0].message.content.trim();
      }
      const { clean, boldRuns } = parseTranslated(aiText);
      await applyRuns(node, clean, boldRuns, runs);
      translationState = 'Completed';
    } catch (e) {
      console.error('Translation error:', e);
      figma.notify('Translation failed: ' + e.message);
      translationState = 'Failed';
    }
  }

  if (translationState == 'Completed') {
    figma.notify(`Translation ${translationState}.`);
  }
};
