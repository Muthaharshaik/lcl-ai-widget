import PptxGenJS from 'pptxgenjs'
import { saveAs } from 'file-saver'

export function extractPptCode(fullContent) {
  const match = fullContent.match(/%%PPT_CODE_START%%([\s\S]*?)%%PPT_CODE_END%%/)
  return match ? match[1].trim() : null
}

// ─── SafeProxy ────────────────────────────────────────────────────────────────
// Wraps every PptxGenJS slide method so bad values from AI-generated code
// never reach PptxGenJS internals. Fixes ALL runtime errors:
//   • "(colorStr || '').replace is not a function"  → color passed as object/number
//   • "Cannot read properties of undefined (reading 'length')"  → bad chart data
//   • Any future type mismatch in shape/text/chart options
//
// Injected as source text into the new Function() body so it runs
// in the same scope as the AI-generated code.
const SAFE_PROXY_SRC = `
function __safeProxy(prs) {
  // ── Color coercion ──────────────────────────────────────────────
  // PptxGenJS expects hex strings without '#', e.g. "FFFFFF"
  // AI code sometimes passes: '#FFFFFF', rgb objects, numbers, undefined
  function __toHex(c) {
    if (c == null) return null;
    if (typeof c === 'string') {
      var s = c.trim().replace(/^#/, '');
      return s.length >= 3 ? s.toUpperCase() : null;
    }
    if (typeof c === 'number') {
      return Math.floor(c).toString(16).padStart(6, '0').toUpperCase();
    }
    if (typeof c === 'object' && c !== null) {
      var r = Math.min(255, Math.max(0, Math.round(c.r || 0)));
      var g = Math.min(255, Math.max(0, Math.round(c.g || 0)));
      var b = Math.min(255, Math.max(0, Math.round(c.b || 0)));
      return (r.toString(16).padStart(2,'0') +
              g.toString(16).padStart(2,'0') +
              b.toString(16).padStart(2,'0')).toUpperCase();
    }
    return null;
  }

  // ── Options sanitizer ──────────────────────────────────────────
  // Deep-cleans an options object: fixes colors, numbers, arrays
  function __fixOpts(opts) {
    if (!opts || typeof opts !== 'object') return opts;
    var o = Object.assign({}, opts);

    // Scalar color fields
    var colorFields = ['color', 'fontColor', 'lineColor', 'catAxisLabelColor',
                       'valAxisLabelColor', 'dataLabelColor', 'titleColor'];
    colorFields.forEach(function(k) {
      if (k in o && o[k] != null) {
        var h = __toHex(o[k]);
        if (h) o[k] = h;
      }
    });

    // Array of colors (e.g. chartColors)
    if (Array.isArray(o.chartColors)) {
      o.chartColors = o.chartColors.map(function(c) { return __toHex(c) || c; });
    }

    // fill.color
    if (o.fill && typeof o.fill === 'object') {
      o.fill = Object.assign({}, o.fill);
      if (o.fill.color != null) { var h = __toHex(o.fill.color); if (h) o.fill.color = h; }
    }

    // line.color
    if (o.line && typeof o.line === 'object') {
      o.line = Object.assign({}, o.line);
      if (o.line.color != null) { var h = __toHex(o.line.color); if (h) o.line.color = h; }
    }

    // background.color
    if (o.background && typeof o.background === 'object') {
      o.background = Object.assign({}, o.background);
      if (o.background.color != null) {
        var h = __toHex(o.background.color);
        if (h) o.background.color = h;
      }
    }

    // Ensure numeric fields are numbers
    var numFields = ['x','y','w','h','fontSize','lineSpacing',
                     'transparency','valAxisMaxVal','valAxisMinVal'];
    numFields.forEach(function(k) {
      if (k in o && o[k] != null && typeof o[k] !== 'number') {
        var n = parseFloat(o[k]);
        if (!isNaN(n)) o[k] = n;
      }
    });

    return o;
  }

  // ── Chart data sanitizer ───────────────────────────────────────
  function __fixChartData(data) {
    if (!Array.isArray(data)) return [{ name: 'Data', labels: [''], values: [0] }];
    return data.map(function(series) {
      if (!series || typeof series !== 'object') return { name:'', labels:[''], values:[0] };
      return {
        name:   typeof series.name === 'string' ? series.name : String(series.name || ''),
        labels: Array.isArray(series.labels)
          ? series.labels.map(function(l) { return l == null ? '' : String(l); })
          : [''],
        values: Array.isArray(series.values)
          ? series.values.map(function(v) {
              var n = parseFloat(v);
              return isNaN(n) ? 0 : n;
            })
          : [0],
      };
    });
  }

  // ── Slide wrapper ──────────────────────────────────────────────
  function __wrapSlide(slide) {
    var methods = ['addShape','addText','addChart','addTable','addImage','addMedia'];
    methods.forEach(function(m) {
      if (typeof slide[m] !== 'function') return;
      var orig = slide[m].bind(slide);
      slide[m] = function() {
        var args = Array.prototype.slice.call(arguments);
        try {
          // Fix chart data (2nd arg for addChart)
          if (m === 'addChart' && args.length >= 2) {
            args[1] = __fixChartData(args[1]);
          }
          // Fix options (last arg if object, skip arrays)
          var last = args[args.length - 1];
          if (last && typeof last === 'object' && !Array.isArray(last)) {
            args[args.length - 1] = __fixOpts(last);
          }
          return orig.apply(null, args);
        } catch(e) {
          console.warn('[AILCL] Skipped ' + m + ':', e.message, '| args:', JSON.stringify(args).slice(0,200));
          return { addText: function(){}, addShape: function(){} };
        }
      };
    });

    // ── ES6 Proxy: intercept direct property assignments ──────────
    // slide.background = { color: COLORS.xxx } bypasses method wrapping
    // and crashes PptxGenJS during prs.write() if color is not a string.
    return new Proxy(slide, {
      set: function(target, prop, value) {
        if (value && typeof value === 'object') {
          // Fix .background = { color: ... }
          if (prop === 'background' && value.color != null) {
            var h = __toHex(value.color);
            if (h) value = Object.assign({}, value, { color: h });
          }
          // Fix .color = object  (direct color assignment)
          if (prop === 'color' && typeof value !== 'string') {
            var h = __toHex(value);
            if (h) value = h;
          }
        }
        target[prop] = value;
        return true;
      }
    });
  }

  // ── Wrap addSlide ──────────────────────────────────────────────
  var _origAddSlide = prs.addSlide.bind(prs);
  prs.addSlide = function() {
    return __wrapSlide(_origAddSlide.apply(null, arguments));
  };

  // ── Wrap prs.defineSlideMaster (also accepts colors) ───────────
  if (typeof prs.defineSlideMaster === 'function') {
    var _origDSM = prs.defineSlideMaster.bind(prs);
    prs.defineSlideMaster = function(opts) {
      return _origDSM(__fixOpts(opts || {}));
    };
  }

  // ── Proxy prs itself for background/color property assignments ──
  return new Proxy(prs, {
    set: function(target, prop, value) {
      if (value && typeof value === 'object') {
        if (prop === 'background' && value.color != null) {
          var h = __toHex(value.color);
          if (h) value = Object.assign({}, value, { color: h });
        }
      }
      target[prop] = value;
      return true;
    }
  });
}
`

// ─── Deep color sanitizer ─────────────────────────────────────────────────────
// Runs AFTER the AI code executes, BEFORE prs.write().
// Recursively walks every object in the PptxGenJS presentation and converts
// any non-string color value to a valid hex string.
// This is the permanent fix — no matter what the AI generates, all colors are
// coerced before PptxGenJS internally processes them.
function deepFixColors(obj, visited) {
  if (!obj || typeof obj !== 'object') return;
  visited = visited || new WeakSet();
  if (visited.has(obj)) return;
  visited.add(obj);

  const COLOR_KEYS = {
    color: true, fontColor: true, lineColor: true,
    catAxisLabelColor: true, valAxisLabelColor: true,
    dataLabelColor: true, titleColor: true, lineBackColor: true,
  };

  const toHex = (c) => {
    if (c == null || typeof c === 'string') return c;
    if (typeof c === 'number')
      return Math.floor(c).toString(16).padStart(6, '0').toUpperCase();
    if (typeof c === 'object') {
      const h = n => Math.min(255, Math.max(0, Math.round(n || 0)))
                        .toString(16).padStart(2, '0');
      return (h(c.r || 0) + h(c.g || 0) + h(c.b || 0)).toUpperCase();
    }
    return null;
  };

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (COLOR_KEYS[key] && val != null && typeof val !== 'string') {
      obj[key] = toHex(val) || 'FFFFFF';
    } else if (key === 'chartColors' && Array.isArray(val)) {
      obj[key] = val.map(c => (typeof c === 'string' ? c : toHex(c) || 'FFFFFF'));
    } else if (val && typeof val === 'object') {
      deepFixColors(val, visited);
    }
  }
}

// ─── Code adapter ─────────────────────────────────────────────────────────────
function adaptCodeForBrowser(code) {
  if (!code) return ''

  // 1. Strip end marker and anything after it
  const endMarkerIdx = code.indexOf('%%PPT_CODE_END%%')
  if (endMarkerIdx !== -1) code = code.slice(0, endMarkerIdx)

  // 2. Remove require / module.exports / addImage / markdown fences
  code = code.replace(/const\s+pptxgen\s*=\s*require\(['"]pptxgenjs['"]\);?/g, '// injected')
  code = code.replace(/module\.exports\s*=\s*\{[^}]*\};?/g, '')
  code = code.replace(/\w+\.addImage\s*\([^;]*\);?/gs, '')
  code = code.replace(/```javascript/g, '').replace(/```js/g, '').replace(/```/g, '')

  // 3. ShapeType → string literals
  code = code.replace(/prs\.ShapeType\.RECTANGLE/g, '"rect"')
  code = code.replace(/prs\.ShapeType\.OVAL/g, '"ellipse"')
  code = code.replace(/prs\.ShapeType\.CIRCLE/g, '"ellipse"')
  code = code.replace(/prs\.ShapeType\.LINE/g, '"line"')
  code = code.replace(/prs\.ShapeType\.ROUNDED_RECTANGLE/g, '"roundRect"')
  code = code.replace(/prs\.ShapeType\.RIGHT_TRIANGLE/g, '"rtTriangle"')
  code = code.replace(/prs\.ShapeType\.TRIANGLE/g, '"triangle"')
  code = code.replace(/prs\.ShapeType\.\w+/g, '"rect"')

  // 4. ChartType → lowercase string literals
  //    AI writes prs.ChartType.BAR / .Bar / .bar — all become "bar"
  code = code.replace(/(?:prs|PptxGenJS|pptxgen)\.ChartType\.(\w+)/g, (_, t) => `"${t.toLowerCase()}"`)

  // 5. Other enum refs
  code = code.replace(/prs\.AlignH\.(\w+)/g, (_, t) => `"${t.toLowerCase()}"`)
  code = code.replace(/prs\.AlignV\.(\w+)/g, (_, t) => `"${t.toLowerCase()}"`)
  code = code.replace(/prs\.TextV\.(\w+)/g,  (_, t) => `"${t.toLowerCase()}"`)

  // 6. Wrap the prs constructor call with __safeProxy
  //    const prs = new pptxgen()  →  let prs = __safeProxy(new pptxgen())
  code = code.replace(
    /(?:const|let|var)\s+(prs|\w*[Pp]res\w*|\w*[Pp]pt\w*)\s*=\s*new\s+pptxgen\s*\(\s*\)/g,
    'let $1 = __safeProxy(new pptxgen())'
  )

  // 7. Fix word apostrophes in single-quoted strings
  code = code.replace(/(\w)'(\w)/g, "$1\\'$2")

  return code.trim()
}

// ─── Download ─────────────────────────────────────────────────────────────────
export async function generateAndDownloadPptx(code, filename = 'LCL-AI-Presentation') {
  try {
    const adaptedCode = adaptCodeForBrowser(code)

    // Detect presentation variable name
    const varMatch    = adaptedCode.match(
      /(?:const|let|var)\s+(\w+)\s*=\s*__safeProxy\s*\(\s*new\s+pptxgen/
    )
    const detectedVar  = varMatch ? varMatch[1] : null
    const fallbackVars = ['prs', 'pptxgen', 'pptx', 'presentation', 'deck']
    const allVars      = detectedVar
      ? [detectedVar, ...fallbackVars.filter(v => v !== detectedVar)]
      : fallbackVars
    const returnExpr   = allVars
      .map(v => `(typeof ${v} !== 'undefined' && ${v} && typeof ${v}.write === 'function' ? ${v} : null)`)
      .join(' || ')

    const wrappedCode = `
      ${SAFE_PROXY_SRC}
      const pptxgen = PptxGenJS;
      ${adaptedCode}
      return ${returnExpr};
    `

    let executeCode
    try {
      executeCode = new Function('PptxGenJS', wrappedCode)
    } catch (err) {
      console.error('[AILCL] PPTX syntax error:', err.message)
      throw new Error('The AI generated code with a syntax error. Please click Refresh or try again.')
    }

    let prs
    try {
      prs = executeCode(PptxGenJS)
    } catch (err) {
      console.error('[AILCL] PPTX execution error:', err.message)
      throw new Error(`Presentation generation failed: ${err.message}. Please try again.`)
    }

    if (!prs) throw new Error('No presentation object found. Please try again.')

    // ── Deep-sanitize ALL color values before PptxGenJS processes them ────────
    // This is the permanent fix: walk every object in the prs data structure
    // and coerce any non-string color to a valid hex string.
    // Catches: slide.background.color, shape fill/line colors, chart colors,
    // text run colors — everything, regardless of what the AI generated.
    deepFixColors(prs)

    const blob = await prs.write({ outputType: 'blob' })
    saveAs(blob, `${filename}.pptx`)
    return { success: true }

  } catch (error) {
    console.error('generatePptx error:', error)
    return { success: false, error: error.message }
  }
}

export async function generatePptxPreviewSlides(code) {
  return { success: false, error: 'Preview disabled — use Download .pptx' }
}