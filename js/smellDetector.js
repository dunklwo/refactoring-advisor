/**
 * smellDetector.js
 * Rule-based detection of 7 code smell types.
 * Rules are loaded from config/smells.json at runtime.
 * Returns a prioritised SmellList (HIGH first, then MEDIUM, LOW).
 */

const SmellDetector = (() => {

  let _rules = null;

  async function loadRules() {
    if (_rules) return _rules;

    // On file:// protocol, fetch() is blocked by browser security.
    // Use inline rules directly to avoid silent failures.
    if (window.location.protocol === 'file:') {
      _rules = _fallbackRules();
      return _rules;
    }

    try {
      const res = await fetch('config/smells.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      _rules = data.smells;
    } catch (e) {
      _rules = _fallbackRules();
    }
    return _rules;
  }

  /**
   * Main entry point.
   * @param {string} code       - source code
   * @param {string} lang       - 'python'|'java'|'c'
   * @param {object} structure  - { functions, classes, lines } from Tokenizer
   * @param {object} tokens     - { operators, operands } from Tokenizer
   * @returns {Promise<Array>}  - array of smell objects
   */
  async function detect(code, lang, structure, tokens) {
    const rules = await loadRules();
    const lines = code.split('\n');
    const smells = [];

    const ruleMap = {};
    rules.forEach(r => ruleMap[r.id] = r);

    // ── FR-3.1: Long Method ────────────────────────────────────────────────
    const longMethodRule = ruleMap['LONG_METHOD'];
    structure.functions.forEach(fn => {
      if (fn.loc > longMethodRule.threshold) {
        smells.push({
          id: 'LONG_METHOD',
          label: longMethodRule.label,
          severity: longMethodRule.severity,
          description: longMethodRule.description,
          lineRange: `Lines ${fn.startLine}–${fn.endLine}`,
          affectedName: fn.name,
          detail: `Function '${fn.name}' has ${fn.loc} lines (threshold: ${longMethodRule.threshold})`,
          pattern: longMethodRule.pattern,
          rationale: longMethodRule.rationale,
          beforeSnippet: extractLines(lines, fn.startLine - 1, Math.min(fn.startLine + 5, fn.endLine)),
          afterSnippet: generateLongMethodFix(fn, lang)
        });
      }
    });

    // ── FR-3.2: God Class ─────────────────────────────────────────────────
    const godRule = ruleMap['GOD_CLASS'];
    if (lang === 'python') {
      const classBlocks = detectPythonClasses(lines);
      classBlocks.forEach(cls => {
        if (cls.methods > godRule.threshold_methods || cls.attrs > godRule.threshold_attrs) {
          smells.push({
            id: 'GOD_CLASS',
            label: godRule.label,
            severity: godRule.severity,
            description: godRule.description,
            lineRange: `Line ${cls.startLine}`,
            affectedName: cls.name,
            detail: `Class '${cls.name}': ${cls.methods} methods, ${cls.attrs} attributes`,
            pattern: godRule.pattern,
            rationale: godRule.rationale,
            beforeSnippet: extractLines(lines, cls.startLine - 1, cls.startLine + 2),
            afterSnippet: `# Split into focused classes:\nclass ${cls.name}Core:\n    # Core responsibilities\n    pass\n\nclass ${cls.name}Helper:\n    # Secondary responsibilities\n    pass`
          });
        }
      });
    }
    if (lang === 'java') {
      const javaClasses = detectJavaClasses(code);
      javaClasses.forEach(cls => {
        if (cls.methods > godRule.threshold_methods || cls.attrs > godRule.threshold_attrs) {
          smells.push({
            id: 'GOD_CLASS',
            label: godRule.label,
            severity: godRule.severity,
            description: godRule.description,
            lineRange: `Line ${cls.startLine}`,
            affectedName: cls.name,
            detail: `Class '${cls.name}': ~${cls.methods} methods detected`,
            pattern: godRule.pattern,
            rationale: godRule.rationale,
            beforeSnippet: extractLines(lines, cls.startLine - 1, cls.startLine + 2),
            afterSnippet: `// Refactor: extract responsibilities\npublic class ${cls.name}Core { ... }\npublic class ${cls.name}Service { ... }`
          });
        }
      });
    }

    // ── FR-3.3: Dead Code ─────────────────────────────────────────────────
    const deadRule = ruleMap['DEAD_CODE'];
    const deadFunctions = detectDeadCode(code, lang, structure.functions);
    deadFunctions.forEach(fn => {
      smells.push({
        id: 'DEAD_CODE',
        label: deadRule.label,
        severity: deadRule.severity,
        description: deadRule.description,
        lineRange: `Line ${fn.startLine}`,
        affectedName: fn.name,
        detail: `'${fn.name}' is defined but never called`,
        pattern: deadRule.pattern,
        rationale: deadRule.rationale,
        beforeSnippet: extractLines(lines, fn.startLine - 1, fn.startLine + 2),
        afterSnippet: `# Remove unused function '${fn.name}'\n# or mark it:\n# @deprecated\n# def ${fn.name}(...):`
      });
    });

    // ── FR-3.4: Long Parameter List ───────────────────────────────────────
    const paramRule = ruleMap['LONG_PARAM_LIST'];
    structure.functions.forEach(fn => {
      if (fn.params && fn.params.length > paramRule.threshold) {
        smells.push({
          id: 'LONG_PARAM_LIST',
          label: paramRule.label,
          severity: paramRule.severity,
          description: paramRule.description,
          lineRange: `Line ${fn.startLine}`,
          affectedName: fn.name,
          detail: `'${fn.name}' has ${fn.params.length} parameters (threshold: ${paramRule.threshold})`,
          pattern: paramRule.pattern,
          rationale: paramRule.rationale,
          beforeSnippet: `def ${fn.name}(${fn.params.join(', ')}):`,
          afterSnippet: generateParamObjectFix(fn, lang)
        });
      }
    });

    // ── FR-3.5: Duplicate Code ────────────────────────────────────────────
    const dupRule = ruleMap['DUPLICATE_CODE'];
    const duplicates = detectDuplicates(lines, dupRule.threshold);
    duplicates.forEach(dup => {
      smells.push({
        id: 'DUPLICATE_CODE',
        label: dupRule.label,
        severity: dupRule.severity,
        description: dupRule.description,
        lineRange: `Lines ${dup.line1}–${dup.line1 + dup.blockSize - 1} and ${dup.line2}–${dup.line2 + dup.blockSize - 1}`,
        affectedName: 'code block',
        detail: `${dup.blockSize}-line block duplicated at lines ${dup.line1} and ${dup.line2}`,
        pattern: dupRule.pattern,
        rationale: dupRule.rationale,
        beforeSnippet: extractLines(lines, dup.line1 - 1, dup.line1 + dup.blockSize - 1),
        afterSnippet: `# Extract to a shared function:\ndef extracted_logic(...):\n    ${lines[dup.line1 - 1].trim()}\n    ...\n\n# Call in both places:\nextracted_logic(...)`
      });
    });

    // ── FR-3.6: Magic Numbers ─────────────────────────────────────────────
    const magicRule = ruleMap['MAGIC_NUMBER'];
    const magicLines = detectMagicNumbers(lines, lang);
    if (magicLines.length > 0) {
      smells.push({
        id: 'MAGIC_NUMBER',
        label: magicRule.label,
        severity: magicRule.severity,
        description: magicRule.description,
        lineRange: `Lines: ${magicLines.slice(0, 5).join(', ')}${magicLines.length > 5 ? '...' : ''}`,
        affectedName: `${magicLines.length} occurrence(s)`,
        detail: `${magicLines.length} bare numeric literal(s) detected on lines: ${magicLines.slice(0,5).join(', ')}`,
        pattern: magicRule.pattern,
        rationale: magicRule.rationale,
        beforeSnippet: extractLines(lines, magicLines[0] - 1, magicLines[0]),
        afterSnippet: lang === 'python'
          ? `MAX_SIZE = 100  # named constant\nTIMEOUT_SECS = 30\n\nif length > MAX_SIZE:\n    sleep(TIMEOUT_SECS)`
          : `static final int MAX_SIZE = 100;\nstatic final int TIMEOUT_SECS = 30;\n\nif (length > MAX_SIZE) { ... }`
      });
    }

    // ── FR-3.7: Deep Nesting ──────────────────────────────────────────────
    const nestRule = ruleMap['DEEP_NESTING'];
    const deepLines = detectDeepNesting(lines, lang, nestRule.threshold);
    if (deepLines.length > 0) {
      smells.push({
        id: 'DEEP_NESTING',
        label: nestRule.label,
        severity: nestRule.severity,
        description: nestRule.description,
        lineRange: `Line ${deepLines[0]}`,
        affectedName: 'control flow',
        detail: `Nesting depth > ${nestRule.threshold} found at line(s): ${deepLines.slice(0,4).join(', ')}`,
        pattern: nestRule.pattern,
        rationale: nestRule.rationale,
        beforeSnippet: extractLines(lines, deepLines[0] - 1, deepLines[0] + 3),
        afterSnippet: lang === 'python'
          ? `# Use guard clauses:\ndef process(data):\n    if not data:\n        return None\n    if not data.valid:\n        return None\n    # Main logic here (flat)`
          : `// Use guard clauses:\nvoid process(Data data) {\n    if (data == null) return;\n    if (!data.isValid()) return;\n    // Main logic here (flat)\n}`
      });
    }

    // Sort: HIGH → MEDIUM → LOW
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    smells.sort((a, b) => order[a.severity] - order[b.severity]);

    return smells;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function extractLines(lines, from, to) {
    return lines.slice(from, to).join('\n');
  }

  function detectPythonClasses(lines) {
    const classes = [];
    let current = null;
    let baseIndent = 0;

    lines.forEach((line, idx) => {
      const clsMatch = line.match(/^(\s*)class\s+(\w+)/);
      if (clsMatch) {
        if (current) classes.push(current);
        baseIndent = clsMatch[1].length;
        current = { name: clsMatch[2], startLine: idx + 1, methods: 0, attrs: 0 };
      }
      if (current) {
        if (line.match(/^\s{2,}def\s+\w+/)) current.methods++;
        if (line.match(/^\s{2,}self\.\w+\s*=/)) current.attrs++;
      }
    });
    if (current) classes.push(current);
    return classes;
  }

  function detectJavaClasses(code) {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    let m;
    const codeLines = code.split('\n');
    while ((m = classRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, m.index).split('\n').length;
      const methodCount = (code.match(/(?:public|private|protected|void|int|String)\s+\w+\s*\([^)]*\)\s*\{/g) || []).length;
      classes.push({ name: m[1], startLine: lineNum, methods: methodCount, attrs: 0 });
    }
    return classes;
  }

  function detectDeadCode(code, lang, functions) {
    return functions.filter(fn => {
      if (fn.name === 'main' || fn.name === '__init__') return false;
      // Count how many times the name appears outside its definition
      const allOccurrences = (code.match(new RegExp(`\\b${fn.name}\\b`, 'g')) || []).length;
      return allOccurrences <= 1; // Only the definition itself
    });
  }

  function detectDuplicates(lines, minSize) {
    const duplicates = [];
    const seen = new Map();

    for (let i = 0; i <= lines.length - minSize; i++) {
      const block = lines.slice(i, i + minSize)
        .map(l => l.trim())
        .filter(l => l.length > 2)
        .join('|');

      if (block.length < 30) continue; // Skip trivial blocks

      if (seen.has(block)) {
        const firstLine = seen.get(block);
        if (!duplicates.some(d => Math.abs(d.line1 - firstLine) < minSize)) {
          duplicates.push({ line1: firstLine + 1, line2: i + 1, blockSize: minSize });
        }
      } else {
        seen.set(block, i);
      }
    }
    return duplicates.slice(0, 3); // Max 3 duplicate reports
  }

  function detectMagicNumbers(lines, lang) {
    const magicLines = [];
    // Allow: array indices [0], [1], common constants like 0, 1, -1, 2
    const magicRegex = /(?<!['"a-zA-Z_])(?<!\.)(\b\d{2,}\b|\b[3-9]\b)/g;
    const assignRegex = /(?:const|final|#define|[A-Z_]{2,}\s*=)/;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (assignRegex.test(trimmed)) return; // It's a constant definition

      const m = trimmed.match(magicRegex);
      if (m) magicLines.push(idx + 1);
    });
    return magicLines;
  }

  function detectDeepNesting(lines, lang, threshold) {
    const deepLines = [];
    if (lang === 'python') {
      lines.forEach((line, idx) => {
        const indent = line.match(/^(\s*)/)[1].length;
        const nestLevel = Math.floor(indent / 4);
        if (nestLevel > threshold && line.trim()) {
          deepLines.push(idx + 1);
        }
      });
    } else {
      // For Java/C: count opening braces up to this line
      let depth = 0;
      lines.forEach((line, idx) => {
        for (const ch of line) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        if (depth > threshold) deepLines.push(idx + 1);
      });
    }
    return deepLines;
  }

  function generateLongMethodFix(fn, lang) {
    if (lang === 'python') {
      return `def ${fn.name}_part1(...):\n    # First logical block\n    pass\n\ndef ${fn.name}_part2(...):\n    # Second logical block\n    pass\n\ndef ${fn.name}(...):\n    ${fn.name}_part1(...)\n    ${fn.name}_part2(...)`;
    }
    return `// Extract into smaller methods:\nprivate void ${fn.name}Step1() { ... }\nprivate void ${fn.name}Step2() { ... }\n\npublic void ${fn.name}() {\n    ${fn.name}Step1();\n    ${fn.name}Step2();\n}`;
  }

  function generateParamObjectFix(fn, lang) {
    const objName = fn.name.charAt(0).toUpperCase() + fn.name.slice(1) + 'Params';
    if (lang === 'python') {
      return `from dataclasses import dataclass\n\n@dataclass\nclass ${objName}:\n    ${fn.params.map(p => p.split(':')[0].trim() + ': object').join('\n    ')}\n\ndef ${fn.name}(params: ${objName}):\n    # Use params.field instead of positional args\n    pass`;
    }
    return `class ${objName} {\n    ${fn.params.join(';\n    ')};\n}\n\nvoid ${fn.name}(${objName} params) {\n    // Use params.field\n}`;
  }

  function _fallbackRules() {
    return [
      { id:'LONG_METHOD',    label:'Long Method',           severity:'HIGH',   threshold:30, pattern:'Extract Method', rationale:'Break into smaller functions.', description:'Function exceeds 30 LOC.' },
      { id:'GOD_CLASS',      label:'God Class',             severity:'HIGH',   threshold_methods:10, threshold_attrs:20, pattern:'Extract Class', rationale:'Split responsibilities.', description:'Class has too many methods/attrs.' },
      { id:'DEAD_CODE',      label:'Dead Code',             severity:'MEDIUM', pattern:'Remove Dead Code', rationale:'Remove unused declarations.', description:'Declared but never called.' },
      { id:'LONG_PARAM_LIST',label:'Long Parameter List',   severity:'MEDIUM', threshold:4, pattern:'Introduce Parameter Object', rationale:'Group params into object.', description:'More than 4 parameters.' },
      { id:'DUPLICATE_CODE', label:'Duplicate Code',        severity:'HIGH',   threshold:5, pattern:'Extract Method', rationale:'Extract shared logic.', description:'Identical blocks appear twice.' },
      { id:'MAGIC_NUMBER',   label:'Magic Number',          severity:'LOW',    pattern:'Replace Magic Number with Constant', rationale:'Use named constants.', description:'Bare literals in code.' },
      { id:'DEEP_NESTING',   label:'Deeply Nested Code',    severity:'MEDIUM', threshold:4, pattern:'Guard Clauses', rationale:'Use early returns.', description:'Nesting > 4 levels.' }
    ];
  }

  return { detect, loadRules };

})();
