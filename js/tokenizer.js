/**
 * tokenizer.js
 * Language-aware tokenizer for Python, Java, and C.
 * Produces operator/operand frequency maps for Halstead analysis.
 */

const Tokenizer = (() => {

  // ── Language definitions ───────────────────────────────────────────────────

  const LANG_DEFS = {
    python: {
      keywords_operators: [
        'and', 'or', 'not', 'in', 'is', 'if', 'else', 'elif',
        'for', 'while', 'return', 'import', 'from', 'class',
        'def', 'lambda', 'with', 'as', 'try', 'except',
        'finally', 'raise', 'pass', 'break', 'continue', 'yield',
        'del', 'global', 'nonlocal', 'assert'
      ],
      symbol_operators: [
        '**=', '//=', '>>=', '<<=', '**', '//', '==', '!=',
        '<=', '>=', '->', ':=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '~=',
        '+', '-', '*', '/', '%', '=', '<', '>',
        '&', '|', '^', '~', '(', ')', '[', ']', '{', '}',
        ',', '.', ':', '@'
      ],
      comment_line: '#',
      string_regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'/g
    },
    java: {
      keywords_operators: [
        'abstract', 'assert', 'break', 'case', 'catch', 'class',
        'continue', 'default', 'do', 'else', 'enum', 'extends',
        'final', 'finally', 'for', 'if', 'implements', 'import',
        'instanceof', 'interface', 'new', 'package', 'private',
        'protected', 'public', 'return', 'static', 'super',
        'switch', 'synchronized', 'this', 'throw', 'throws',
        'try', 'void', 'while'
      ],
      symbol_operators: [
        '>>>=', '>>=', '<<=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '==', '!=', '<=', '>=',
        '&&', '||', '++', '--', '>>', '<<', '>>>',
        '+', '-', '*', '/', '%', '=', '<', '>',
        '&', '|', '^', '~', '!', '?', ':',
        '(', ')', '[', ']', '{', '}', ',', '.', ';'
      ],
      comment_line: '//',
      comment_block: ['/*', '*/'],
      string_regex: /"[^"\\]*(?:\\.[^"\\]*)*"/g
    },
    c: {
      keywords_operators: [
        'auto', 'break', 'case', 'char', 'const', 'continue',
        'default', 'do', 'double', 'else', 'enum', 'extern',
        'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
        'register', 'restrict', 'return', 'short', 'signed',
        'sizeof', 'static', 'struct', 'switch', 'typedef',
        'union', 'unsigned', 'void', 'volatile', 'while'
      ],
      symbol_operators: [
        '>>=', '<<=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '==', '!=', '<=', '>=',
        '&&', '||', '++', '--', '>>', '<<', '->',
        '+', '-', '*', '/', '%', '=', '<', '>',
        '&', '|', '^', '~', '!', '?', ':',
        '(', ')', '[', ']', '{', '}', ',', '.', ';', '#'
      ],
      comment_line: '//',
      comment_block: ['/*', '*/'],
      string_regex: /"[^"\\]*(?:\\.[^"\\]*)*"/g
    }
  };

  // ── Preprocessing ───────────────────────────────────────────────────────────

  function stripStrings(code, lang) {
    const def = LANG_DEFS[lang];
    if (def.string_regex) {
      return code.replace(def.string_regex, '""');
    }
    return code;
  }

  function stripComments(code, lang) {
    const def = LANG_DEFS[lang];
    let result = code;

    // Block comments
    if (def.comment_block) {
      const [open, close] = def.comment_block;
      const escapedOpen = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedClose = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`${escapedOpen}[\\s\\S]*?${escapedClose}`, 'g'), '');
    }

    // Line comments
    if (def.comment_line) {
      const escaped = def.comment_line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`${escaped}.*$`, 'gm'), '');
    }

    return result;
  }

  // ── Core tokenization ───────────────────────────────────────────────────────

  function tokenize(rawCode, lang) {
    if (!LANG_DEFS[lang]) lang = 'python';
    const def = LANG_DEFS[lang];

    let code = stripStrings(rawCode, lang);
    code = stripComments(code, lang);

    const operators = {};   // map: token -> count
    const operands  = {};   // map: token -> count

    // Track defined / used identifiers for dead code detection
    const defined = new Set();
    const used    = new Set();

    // --- Symbol operators (sort longest first to avoid partial matches) ---
    const sortedSymbols = [...def.symbol_operators].sort((a, b) => b.length - a.length);

    let i = 0;
    const lines = code.split('\n');
    const flatCode = code;

    // Simple character-by-character scan
    let pos = 0;
    while (pos < flatCode.length) {
      // Skip whitespace
      if (/\s/.test(flatCode[pos])) { pos++; continue; }

      // Try keyword / identifier
      if (/[a-zA-Z_]/.test(flatCode[pos])) {
        let word = '';
        while (pos < flatCode.length && /\w/.test(flatCode[pos])) {
          word += flatCode[pos++];
        }
        if (def.keywords_operators.includes(word)) {
          operators[word] = (operators[word] || 0) + 1;
        } else {
          operands[word] = (operands[word] || 0) + 1;
          // Track function definitions
          if (lang === 'python' && operands[word] === 1) {
            // Peek if followed by '(' for usage tracking
          }
        }
        continue;
      }

      // Try numeric literal
      if (/[0-9]/.test(flatCode[pos]) || (flatCode[pos] === '.' && /[0-9]/.test(flatCode[pos+1]))) {
        let num = '';
        while (pos < flatCode.length && /[\d.xXeEfFuUlLbB]/.test(flatCode[pos])) {
          num += flatCode[pos++];
        }
        operands[num] = (operands[num] || 0) + 1;
        continue;
      }

      // Try symbol operators
      let matched = false;
      for (const sym of sortedSymbols) {
        if (flatCode.startsWith(sym, pos)) {
          operators[sym] = (operators[sym] || 0) + 1;
          pos += sym.length;
          matched = true;
          break;
        }
      }
      if (!matched) pos++;
    }

    // Build counts
    const n1 = Object.keys(operators).length;       // unique operators
    const n2 = Object.keys(operands).length;         // unique operands
    const N1 = Object.values(operators).reduce((a, b) => a + b, 0); // total operators
    const N2 = Object.values(operands).reduce((a, b) => a + b, 0);  // total operands

    return { operators, operands, n1, n2, N1, N2 };
  }

  // ── Function/class structure extraction (for smell detection) ───────────────

  function extractStructure(code, lang) {
    const lines = code.split('\n');
    const functions = [];
    const classes   = [];

    if (lang === 'python') {
      // Parse functions
      let funcStack = [];
      lines.forEach((line, idx) => {
        const defMatch = line.match(/^(\s*)def\s+(\w+)\s*\((.*?)\)\s*:/);
        if (defMatch) {
          const indent = defMatch[1].length;
          const name   = defMatch[2];
          const params = defMatch[3].split(',').map(p => p.trim()).filter(Boolean);
          funcStack.push({ name, startLine: idx + 1, indent, params });
        }
        const clsMatch = line.match(/^(\s*)class\s+(\w+)/);
        if (clsMatch) {
          classes.push({ name: clsMatch[2], startLine: idx + 1, methods: [], attrs: [] });
        }
      });
      // Approximate end lines by indentation change
      funcStack.forEach(fn => {
        let end = fn.startLine;
        for (let i = fn.startLine; i < lines.length; i++) {
          const l = lines[i];
          if (l.trim() === '') continue;
          const ind = l.match(/^(\s*)/)[1].length;
          if (i > fn.startLine && ind <= fn.indent) { end = i; break; }
          end = i + 1;
        }
        functions.push({ ...fn, endLine: end, loc: end - fn.startLine });
      });

    } else if (lang === 'java' || lang === 'c') {
      // Brace-counting function detection
      let braceDepth = 0;
      let currentFunc = null;
      const methodRegex = lang === 'java'
        ? /(?:public|private|protected|static|void|int|String|boolean|double|float|long|char|Object)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+\w+)?\s*\{/
        : /(?:int|void|char|float|double|long|short|unsigned)\s+(\w+)\s*\(([^)]*)\)\s*\{/;
      const classRegex = /class\s+(\w+)/;

      lines.forEach((line, idx) => {
        const clsMatch = line.match(classRegex);
        if (clsMatch) classes.push({ name: clsMatch[1], startLine: idx + 1, methods: [], attrs: [] });

        const fnMatch = line.match(methodRegex);
        if (fnMatch && braceDepth === 0) {
          const params = fnMatch[2].split(',').map(p => p.trim()).filter(Boolean);
          currentFunc = { name: fnMatch[1], startLine: idx + 1, params, braceStart: braceDepth };
        }

        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') {
            braceDepth--;
            if (currentFunc && braceDepth === currentFunc.braceStart) {
              functions.push({ ...currentFunc, endLine: idx + 1, loc: (idx + 1) - currentFunc.startLine });
              currentFunc = null;
            }
          }
        }
      });
    }

    return { functions, classes, lines };
  }

  // Public API
  return { tokenize, extractStructure };

})();
