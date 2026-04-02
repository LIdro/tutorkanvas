export async function renderMathExpressionToSvg(expression: string): Promise<{ svgMarkup: string; width: number; height: number }> {
  const katex = await import('katex')
  const normalized = normalizeEquationExpression(expression)
  const markup = katex.renderToString(normalized, {
    throwOnError: false,
    displayMode: true,
    output: 'htmlAndMathml',
    strict: 'ignore',
  })

  const svgMarkup = htmlToSvg(markup)
  return {
    svgMarkup,
    width: estimateWidth(normalized),
    height: estimateHeight(normalized),
  }
}

function normalizeEquationExpression(expression: string): string {
  return expression
    .replace(/÷/g, '\\div ')
    .replace(/×/g, '\\times ')
    .replace(/−/g, '-')
    .trim()
}

function htmlToSvg(markup: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="180" viewBox="0 0 900 180">',
    '<foreignObject x="0" y="0" width="900" height="180">',
    '<div xmlns="http://www.w3.org/1999/xhtml"',
    ' style="display:flex;align-items:center;justify-content:center;width:900px;height:180px;',
    ' color:#ffffff;font-size:44px;font-family:KaTeX_Main, serif;">',
    markup,
    '</div>',
    '</foreignObject>',
    '</svg>',
  ].join('')
}

function estimateWidth(expression: string): number {
  return Math.min(900, Math.max(180, expression.length * 28))
}

function estimateHeight(expression: string): number {
  return expression.length > 28 ? 160 : 120
}
